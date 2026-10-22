// The bearer client every app talks to its backends through (lib/apiClient.ts). Ported from
// minty-web's and minty-petty-cash-web's lib/__tests__/apiClient.test.ts and
// minty-payment-request-web's lib/__tests__/apiFetch.test.ts, with the decisions of the
// shared-code refactor (2026-10-22): one house fallback, "" dropped from a query, a 401 decided by
// the app's callback, no request at all without a token.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  HOUSE_FALLBACK,
  SESSION_ENDED,
  createBearerClient,
  errorSentence,
  readBody,
  withQuery,
  type BearerClientOptions,
  type UnauthorizedContext,
} from "../apiClient";
import { statusFallback } from "../errorCopy";

type Handler = (ctx: UnauthorizedContext) => Promise<boolean>;

const BASE = "http://api.test";
const fetchMock = vi.fn<typeof fetch>();

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The nth call's URL, init and headers. */
function sent(n = 0): { url: string; init: RequestInit; headers: Headers } {
  const [url, init] = fetchMock.mock.calls[n];
  return { url: String(url), init: init ?? {}, headers: new Headers(init?.headers) };
}

function client(overrides: Partial<BearerClientOptions> = {}) {
  return createBearerClient({
    baseUrl: BASE,
    getToken: () => "tok",
    onUnauthorized: "reject",
    ...overrides,
  });
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ApiError", () => {
  it("is an Error named ApiError, with status, message and body (null by default)", () => {
    const bare = new ApiError(418, "short and stout");
    expect(bare).toBeInstanceOf(Error);
    expect(bare.name).toBe("ApiError");
    expect(bare.status).toBe(418);
    expect(bare.message).toBe("short and stout");
    expect(bare.body).toBeNull();
    expect(new ApiError(400, "x", { error: "x" }).body).toEqual({ error: "x" });
  });

  it("detail is the server's raw words: a text body, a body field, else the message", () => {
    expect(new ApiError(422, "m", "Invoice number already exists").detail).toBe(
      "Invoice number already exists",
    );
    expect(new ApiError(400, "m", { detail: "AuthenticationUnsuccessful" }).detail).toBe(
      "AuthenticationUnsuccessful",
    );
    expect(new ApiError(400, "m", { error: "e", detail: "d" }).detail).toBe("e");
    expect(new ApiError(400, "m", { detail: { status: 403 } }).detail).toBe('{"status":403}');
    expect(new ApiError(500, "Something went wrong.").detail).toBe("Something went wrong.");
    expect(new ApiError(500, "m", {}).detail).toBe("m");
  });
});

describe("the sentences", () => {
  it("are exact", () => {
    expect(HOUSE_FALLBACK).toBe("Something went wrong on my end. Mind trying again?");
    expect(SESSION_ENDED).toBe("Your session has ended. Signing you back in…");
  });
});

describe("withQuery", () => {
  it("drops undefined, null and empty strings; writes booleans and numbers as text", () => {
    expect(withQuery("/x", { a: undefined, b: "", c: null, d: false, e: 0, f: "1" })).toBe(
      "/x?d=false&e=0&f=1",
    );
  });

  it("joins with & onto a path that already has a query", () => {
    expect(withQuery("/x?keep=1", { page: 2 })).toBe("/x?keep=1&page=2");
    expect(withQuery("/bills/?status=paid", { page: 2 })).toBe("/bills/?status=paid&page=2");
  });

  it("adds no ? when nothing is left, or there is no query", () => {
    expect(withQuery("/x")).toBe("/x");
    expect(withQuery("/x", {})).toBe("/x");
    expect(withQuery("/x", { a: undefined, b: "", c: null })).toBe("/x");
  });

  it("form-encodes the values (a space is +)", () => {
    expect(withQuery("/x", { q: "a b&c" })).toBe("/x?q=a+b%26c");
  });
});

describe("readBody", () => {
  it("is null for an empty body, the value for JSON, the text otherwise", async () => {
    expect(await readBody(new Response(null, { status: 204 }))).toBeNull();
    expect(await readBody(new Response(""))).toBeNull();
    expect(await readBody(json(200, { a: 1 }))).toEqual({ a: 1 });
    expect(await readBody(new Response("plain words"))).toBe("plain words");
  });
});

describe("errorSentence", () => {
  it("is the first non-empty error, detail or message that reads as prose", () => {
    expect(errorSentence({ error: "This company is still setting up." })).toBe(
      "This company is still setting up.",
    );
    expect(errorSentence({ detail: "That invoice number is taken." })).toBe(
      "That invoice number is taken.",
    );
    expect(errorSentence({ message: "Your code has expired." })).toBe("Your code has expired.");
    expect(errorSentence({ error: "", detail: "Django said this." })).toBe("Django said this.");
  });

  it("falls back for a code, a non-string, a text body or nothing", () => {
    expect(errorSentence({ error: "invalid_state" })).toBe(HOUSE_FALLBACK);
    expect(errorSentence({ error: 123 })).toBe(HOUSE_FALLBACK);
    expect(errorSentence({ error: { field: "amount" } })).toBe(HOUSE_FALLBACK);
    expect(errorSentence("Bad Gateway")).toBe(HOUSE_FALLBACK);
    expect(errorSentence(null)).toBe(HOUSE_FALLBACK);
    expect(errorSentence({ error: "" })).toBe(HOUSE_FALLBACK);
    expect(errorSentence(null, "Mine.")).toBe("Mine.");
  });

  it("flattens a pydantic detail list", () => {
    expect(errorSentence({ detail: [{ loc: ["body", "email"], msg: "Field required" }] })).toBe(
      "Field required",
    );
  });
});

describe("the request", () => {
  beforeEach(() => {
    fetchMock.mockImplementation(async () => json(200, {}));
  });

  it("goes to the base and path with the query, the bearer, and asks for JSON", async () => {
    await client().json("/api/x", { query: { page: 2, q: "" } });
    const { url, headers, init } = sent();
    expect(url).toBe(`${BASE}/api/x?page=2`);
    expect(headers.get("Authorization")).toBe("Bearer tok");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.has("Content-Type")).toBe(false);
    expect(headers.has("X-Entity-Id")).toBe(false);
    expect(init.body).toBeUndefined();
  });

  it("reads a function base on every call, without its trailing slashes", async () => {
    let base = "http://one.test/";
    const c = client({ baseUrl: () => base });
    await c.json("/a");
    base = "http://two.test";
    await c.json("/a");
    expect(sent(0).url).toBe("http://one.test/a");
    expect(sent(1).url).toBe("http://two.test/a");
  });

  it("serialises a JSON body with its Content-Type - null included", async () => {
    await client().json("/x", { method: "POST", body: { a: 1 } });
    await client().json("/x", { method: "POST", body: null });
    expect(sent(0).init.method).toBe("POST");
    expect(sent(0).init.body).toBe('{"a":1}');
    expect(sent(0).headers.get("Content-Type")).toBe("application/json");
    expect(sent(1).init.body).toBe("null");
  });

  it("sends a form as it is, leaving its Content-Type to the browser", async () => {
    const form = new FormData();
    form.set("amount", "12.5");
    await client().json("/x", { method: "POST", form });
    expect(sent().init.body).toBe(form);
    expect(sent().headers.has("Content-Type")).toBe(false);
  });

  it("refuses a JSON body and a form together, without calling", async () => {
    await expect(client().json("/x", { body: {}, form: new FormData() })).rejects.toThrow(
      TypeError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the caller's headers and init, but its own Authorization and Accept win", async () => {
    const controller = new AbortController();
    await client().json("/x", {
      method: "DELETE",
      signal: controller.signal,
      headers: { "X-Trace": "t1", Accept: "text/plain", Authorization: "Bearer other" },
    });
    const { init, headers } = sent();
    expect(init.method).toBe("DELETE");
    expect(init.signal).toBe(controller.signal);
    expect(headers.get("X-Trace")).toBe("t1");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer tok");
    expect(init).not.toHaveProperty("query");
    expect(init).not.toHaveProperty("form");
    expect(init).not.toHaveProperty("entityId");
  });

  it("names the company only when entityHeader answers a non-empty id", async () => {
    let entity: string | null = "e1";
    const c = client({ entityHeader: () => entity });
    await c.json("/x");
    entity = "";
    await c.json("/x");
    entity = null;
    await c.json("/x");
    expect(sent(0).headers.get("X-Entity-Id")).toBe("e1");
    expect(sent(1).headers.has("X-Entity-Id")).toBe(false);
    expect(sent(2).headers.has("X-Entity-Id")).toBe(false);
  });

  it("a call's own entityId wins over entityHeader, and an empty one sends none", async () => {
    const c = client({ entityHeader: () => "cookie-co" });
    await c.json("/x", { entityId: "call-co" });
    await c.json("/x", { entityId: "" });
    await createBearerClient({
      baseUrl: BASE,
      getToken: () => "tok",
      onUnauthorized: "reject",
    }).json("/x", { entityId: "e9" });
    expect(sent(0).headers.get("X-Entity-Id")).toBe("call-co");
    expect(sent(1).headers.has("X-Entity-Id")).toBe(false);
    expect(sent(2).headers.get("X-Entity-Id")).toBe("e9");
  });

  it("awaits an async getToken", async () => {
    await client({ getToken: async () => "fresh" }).json("/x");
    expect(sent().headers.get("Authorization")).toBe("Bearer fresh");
  });
});

describe("the answer", () => {
  it("json: the parsed body, null when empty, the text when not JSON", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: 1 }));
    await expect(client().json("/x")).resolves.toEqual({ ok: 1 });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(client().json("/x")).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(new Response("plain words", { status: 200 }));
    await expect(client().json("/x")).resolves.toBe("plain words");
  });

  it("blob: the file, asked for as anything", async () => {
    fetchMock.mockResolvedValueOnce(new Response("%PDF-1.4", { status: 200 }));
    const blob = await client().blob("/f");
    expect(await blob.text()).toBe("%PDF-1.4");
    expect(sent().headers.get("Accept")).toBe("*/*");
  });

  it("response: the unread Response, headers and all", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Date,Amount", {
        status: 200,
        headers: { "Content-Disposition": "attachment; filename=r.csv" },
      }),
    );
    const res = await client().response("/export.csv");
    expect(res.headers.get("Content-Disposition")).toBe("attachment; filename=r.csv");
    expect(await res.text()).toBe("Date,Amount");
  });
});

describe("a refusal", () => {
  it("rejects with the status, the body's sentence and the body", async () => {
    fetchMock.mockResolvedValueOnce(json(409, { error: "This company is still setting up." }));
    const err = await failure(client().json("/x"));
    expect(err).toMatchObject({
      name: "ApiError",
      status: 409,
      message: "This company is still setting up.",
      body: { error: "This company is still setting up." },
    });
  });

  it("falls back to the house line, keeping a text or empty body", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 502 }));
    expect(await failure(client().json("/x"))).toMatchObject({
      status: 502,
      message: HOUSE_FALLBACK,
      body: "<html>",
    });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    expect(await failure(client().blob("/x"))).toMatchObject({
      message: HOUSE_FALLBACK,
      body: null,
    });
  });

  it("an empty error string falls back, it is never shown as an empty message", async () => {
    fetchMock.mockResolvedValueOnce(json(400, { error: "" }));
    expect((await failure(client().json("/x"))).message).toBe(HOUSE_FALLBACK);
  });

  it("never shows a machine code", async () => {
    fetchMock.mockResolvedValueOnce(json(403, { detail: "entity_membership_revoked" }));
    expect((await failure(client().json("/x"))).message).toBe(HOUSE_FALLBACK);
  });

  it("uses a fixed fallback, or one per status", async () => {
    fetchMock.mockResolvedValueOnce(json(500, {}));
    expect((await failure(client({ fallback: "Mine." }).json("/x"))).message).toBe("Mine.");
    fetchMock.mockResolvedValueOnce(
      new Response("<html>502</html>", { status: 502, statusText: "Bad Gateway" }),
    );
    expect((await failure(client({ fallback: statusFallback }).json("/x"))).message).toBe(
      "I couldn't reach the server just now. Mind trying again?",
    );
  });

  it("leaves a dropped connection as fetch's TypeError", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const err = await client()
      .json("/x")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TypeError);
    expect(err).not.toBeInstanceOf(ApiError);
  });
});

describe("a 401", () => {
  it('"reject": SESSION_ENDED, no body, whatever the server said', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: "Token expired." }));
    const err = await failure(client().json("/x"));
    expect(err).toMatchObject({ status: 401, message: SESSION_ENDED, body: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a callback answering false rejects the same way, having been told why", async () => {
    const onUnauthorized = vi.fn<Handler>(async () => false);
    fetchMock.mockResolvedValueOnce(json(401, { detail: "token expired" }));
    const err = await failure(client({ onUnauthorized }).json("/api/x", { query: { a: 1 } }));
    expect(err).toMatchObject({ status: 401, message: SESSION_ENDED, body: null });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledWith({
      path: "/api/x",
      reason: "401",
      body: { detail: "token expired" },
      retried: false,
    });
  });

  it("a callback answering true retries ONCE with a fresh token", async () => {
    let token = "old";
    const onUnauthorized = vi.fn(async () => {
      token = "new";
      return true;
    });
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(200, { ok: 1 }));
    await expect(
      client({ getToken: () => token, onUnauthorized }).json("/x", {
        method: "POST",
        body: { a: 1 },
      }),
    ).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sent(0).headers.get("Authorization")).toBe("Bearer old");
    expect(sent(1).headers.get("Authorization")).toBe("Bearer new");
    expect(sent(1).init.body).toBe('{"a":1}');
  });

  it("a second 401 rejects, telling the callback it was the retry", async () => {
    const onUnauthorized = vi.fn<Handler>(async () => true);
    fetchMock.mockImplementation(async () => json(401, {}));
    const err = await failure(client({ onUnauthorized }).json("/x"));
    expect(err.message).toBe(SESSION_ENDED);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledTimes(2);
    expect(onUnauthorized.mock.calls[1][0]).toMatchObject({ retried: true });
  });

  it("a callback may throw its own refusal, which the call rejects with", async () => {
    const own = new ApiError(401, "You don't have access to that.");
    fetchMock.mockResolvedValueOnce(json(401, { detail: "not_a_member" }));
    const err = await client({
      onUnauthorized: async () => {
        throw own;
      },
    })
      .json("/x")
      .catch((e: unknown) => e);
    expect(err).toBe(own);
  });
});

describe("no token at all", () => {
  it('"reject": rejects with SESSION_ENDED and never calls', async () => {
    for (const token of [null, ""]) {
      const err = await failure(client({ getToken: () => token }).json("/x"));
      expect(err).toMatchObject({ status: 401, message: SESSION_ENDED, body: null });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a callback hears no-token, and a true answer tries getToken once more", async () => {
    const tokens = [null, "found"];
    const onUnauthorized = vi.fn<Handler>(async () => true);
    fetchMock.mockResolvedValueOnce(json(200, { ok: 1 }));
    await expect(
      client({ getToken: () => tokens.shift() ?? null, onUnauthorized }).json("/x"),
    ).resolves.toEqual({ ok: 1 });
    expect(onUnauthorized).toHaveBeenCalledWith({
      path: "/x",
      reason: "no-token",
      body: null,
      retried: false,
    });
    expect(sent().headers.get("Authorization")).toBe("Bearer found");
  });

  it("still none after the retry: rejects without calling", async () => {
    const onUnauthorized = vi.fn<Handler>(async () => true);
    const err = await failure(client({ getToken: () => null, onUnauthorized }).blob("/x"));
    expect(err.message).toBe(SESSION_ENDED);
    expect(onUnauthorized).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
