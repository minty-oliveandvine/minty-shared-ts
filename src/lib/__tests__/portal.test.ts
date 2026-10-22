// The person-scoped reads (lib/portal.ts), ported from minty-web's payerPortal.test.ts and
// sidebarHost.test.ts, minty-payment-request-web's payerSubscriptions.test.ts and
// minty-petty-cash-web's portalAdapters.test.ts. The client is a fake `fetchJson`, so what is
// pinned is exactly what each read asks of it.

import { describe, expect, it, vi } from "vitest";

import {
  MAX_PER_PAGE,
  PortalShapeError,
  UNEXPECTED_SHAPE,
  createProfileApi,
  fetchAllSubscriptions,
  loadViewer,
  type FetchJson,
  type PortalRequest,
} from "../portal";

const ENTITY = "360812e1-9f94-46a3-aa31-347e21afde8e";

/** A fake client answering `answers` in turn (an Error rejects), recording every call. */
function client(...answers: unknown[]) {
  const calls: { path: string; init?: PortalRequest }[] = [];
  const fetchJson = vi.fn(async (path: string, init?: PortalRequest) => {
    calls.push({ path, init });
    const next = answers.shift();
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as FetchJson;
  return { fetchJson, calls };
}

describe("createProfileApi", () => {
  it("loads /api/me/profile for the company, passing the signal on, with no method", async () => {
    const { fetchJson, calls } = client({ user: { name: "J" } });
    const signal = new AbortController().signal;
    await expect(createProfileApi(fetchJson).load(ENTITY, signal)).resolves.toEqual({
      user: { name: "J" },
    });
    expect(calls).toEqual([
      { path: "/api/me/profile", init: { query: { entity: ENTITY }, signal } },
    ]);
  });

  it("names no company when the id is empty or absent", async () => {
    const { fetchJson, calls } = client({}, {}, {});
    const api = createProfileApi(fetchJson);
    await api.load("", new AbortController().signal);
    await api.load(null);
    await api.load();
    expect(calls.map((c) => c.init?.query)).toEqual([undefined, undefined, undefined]);
  });

  it("saves with a PATCH of the changes as the JSON body, for the company", async () => {
    const { fetchJson, calls } = client({ user: { first_name: "Jo" } });
    await expect(createProfileApi(fetchJson).save({ first_name: "Jo" }, ENTITY)).resolves.toEqual({
      user: { first_name: "Jo" },
    });
    expect(calls[0]).toEqual({
      path: "/api/me/profile",
      init: {
        method: "PATCH",
        body: { first_name: "Jo" },
        query: { entity: ENTITY },
        signal: undefined,
      },
    });
  });

  it("lets the client's refusal through as it stands", async () => {
    const refusal = Object.assign(new Error("That name is too long."), { status: 422 });
    const { fetchJson } = client(refusal);
    await expect(createProfileApi(fetchJson).save({ first_name: "x" }, ENTITY)).rejects.toBe(
      refusal,
    );
  });
});

describe("loadViewer", () => {
  it("is the name and the initials, nothing else", async () => {
    const { fetchJson, calls } = client({
      user: { name: "Olive Vine", initials: "OV", email: "o@x.test" },
    });
    expect(await loadViewer(fetchJson)).toEqual({ name: "Olive Vine", initials: "OV" });
    expect(calls).toEqual([{ path: "/api/me/profile", init: undefined }]);
  });

  it.each([null, {}, { user: {} }, { user: { name: "O" } }, { user: { name: 1, initials: "O" } }])(
    "is null for %j",
    async (body) => {
      expect(await loadViewer(client(body).fetchJson)).toBeNull();
    },
  );

  it("rejects on a 401 - the client's rejection, never swallowed", async () => {
    const unauthorized = Object.assign(new Error("Your session has ended."), { status: 401 });
    await expect(loadViewer(client(unauthorized).fetchJson)).rejects.toBe(unauthorized);
  });
});

describe("fetchAllSubscriptions", () => {
  const page = (n: number, pages: number | undefined, ids: string[], extra: object = {}) => ({
    payer: { page: n },
    billing: { page: n },
    entities: ids.map((entity_id) => ({ entity_id })),
    pages,
    ...extra,
  });

  it("asks page 1 at 100 a page, then each page up to page 1's `pages`, in order", async () => {
    const outcomes = [{ id: "t1" }];
    const { fetchJson, calls } = client(
      page(1, 3, ["a", "b"], { transfer_outcomes: outcomes }),
      page(2, 9, ["c"], { transfer_outcomes: [{ id: "t2" }] }),
      page(3, 9, ["d"]),
    );
    const all = await fetchAllSubscriptions(fetchJson);
    expect(MAX_PER_PAGE).toBe(100);
    expect(calls.map((c) => [c.path, c.init?.query])).toEqual([
      ["/api/me/subscriptions", { page: 1, per_page: 100 }],
      ["/api/me/subscriptions", { page: 2, per_page: 100 }],
      ["/api/me/subscriptions", { page: 3, per_page: 100 }],
    ]);
    // payer, billing and the outcomes from the FIRST page only; the companies from all
    expect(all).toEqual({
      payer: { page: 1 },
      billing: { page: 1 },
      entities: [{ entity_id: "a" }, { entity_id: "b" }, { entity_id: "c" }, { entity_id: "d" }],
      transfer_outcomes: outcomes,
    });
  });

  it.each([1, 0, undefined])(
    "reads once for pages=%s; no outcomes is an empty list",
    async (pages) => {
      const { fetchJson, calls } = client(page(1, pages, ["a"]));
      const all = await fetchAllSubscriptions(fetchJson);
      expect(calls).toHaveLength(1);
      expect(all.transfer_outcomes).toEqual([]);
    },
  );

  it("passes the signal to every page, and the caller's query alongside the walk's", async () => {
    const signal = new AbortController().signal;
    const { fetchJson, calls } = client(page(1, 2, ["a"]), page(2, 2, ["b"]));
    await fetchAllSubscriptions(fetchJson, { signal, query: { q: "olive", page: 7 } });
    expect(calls.map((c) => c.init)).toEqual([
      { query: { q: "olive", page: 1, per_page: 100 }, signal },
      { query: { q: "olive", page: 2, per_page: 100 }, signal },
    ]);
  });

  it.each([
    ["an empty body", null],
    ["no entities array", { pages: 1 }],
    ["entities that are not an array", { entities: {}, pages: 1 }],
  ])("refuses %s as a 502 in the house voice", async (_label, body) => {
    const err = await fetchAllSubscriptions(client(body).fetchJson).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PortalShapeError);
    expect(err).toMatchObject({ status: 502, message: UNEXPECTED_SHAPE });
    expect(UNEXPECTED_SHAPE).toBe("That came back in a shape I didn't expect. Mind trying again?");
  });

  it("refuses a bad LATER page too, with the app's own error when it passes one", async () => {
    class ApiError extends Error {
      constructor(
        readonly status: number,
        message: string,
      ) {
        super(message);
      }
    }
    const { fetchJson } = client(page(1, 2, ["a"]), { pages: 2 });
    const err = await fetchAllSubscriptions(fetchJson, {
      shapeError: (status, message) => new ApiError(status, message),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 502, message: UNEXPECTED_SHAPE });
  });

  it("lets the client's error through for a refused page", async () => {
    const down = Object.assign(new Error("Try again later."), { status: 503 });
    const { fetchJson } = client(page(1, 2, ["a"]), down);
    await expect(fetchAllSubscriptions(fetchJson)).rejects.toBe(down);
  });
});
