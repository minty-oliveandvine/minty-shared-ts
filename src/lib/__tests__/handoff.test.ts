// Getting a token and a new one (lib/handoff.ts). Ported from the characterisation tests in
// minty-web (lib/__tests__/handoff.test.ts, mintyEntry.test.ts), minty-petty-cash-web
// (lib/__tests__/handoff.test.ts, hub.test.ts) and minty-payment-request-web
// (lib/__tests__/mintyUrls.test.ts), on one behaviour: next -> entity_id -> return_origin, an unsafe
// next is the app's home, the re-handoff goes once and clears the token first.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addressCompanyRef } from "../companyRef";
import {
  createHandoff,
  flaskHandoffUrl,
  hubHandoffUrl,
  logoutUrl,
  mintyEntryUrl,
} from "../handoff";

const FLASK = "http://flask.test";
const ENTITY = "360812e1-9f94-46a3-aa31-347e21afde8e";
const ORIGIN = encodeURIComponent(window.location.origin);

describe("flaskHandoffUrl and hubHandoffUrl", () => {
  it("write next, entity_id, return_origin in that order", () => {
    expect(hubHandoffUrl(FLASK, "/profile?tab=a b", ENTITY)).toBe(
      `${FLASK}/handoff/minty-web?next=%2Fprofile%3Ftab%3Da+b&entity_id=${ENTITY}&return_origin=${ORIGIN}`,
    );
  });

  it("name no company for an empty or absent id", () => {
    expect(hubHandoffUrl(FLASK, "/entities")).toBe(
      `${FLASK}/handoff/minty-web?next=%2Fentities&return_origin=${ORIGIN}`,
    );
    expect(new URL(hubHandoffUrl(FLASK, "/x", "")).searchParams.has("entity_id")).toBe(false);
    expect(new URL(hubHandoffUrl(FLASK, "/x", null)).searchParams.has("entity_id")).toBe(false);
  });

  it("take the origin they are given - the proxy runs on the server", () => {
    const url = new URL(
      flaskHandoffUrl(
        FLASK,
        "/handoff/petty-cash-web",
        "/p",
        "e1",
        "https://pr-x-pettycash.dailyminty.com",
      ),
    );
    expect(url.pathname).toBe("/handoff/petty-cash-web");
    expect(url.searchParams.get("return_origin")).toBe("https://pr-x-pettycash.dailyminty.com");
  });

  it("drop a trailing slash on the base", () => {
    expect(hubHandoffUrl(`${FLASK}//`, "/x").startsWith(`${FLASK}/handoff/minty-web?`)).toBe(true);
  });
});

describe("logoutUrl", () => {
  it("is Flask's /logout with no way back", () => {
    expect(logoutUrl(FLASK)).toBe(`${FLASK}/logout`);
    expect(logoutUrl(`${FLASK}/`)).toBe(`${FLASK}/logout`);
  });
});

describe("mintyEntryUrl", () => {
  const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";

  it("is /entity/<id>/enter with token, next, return_origin in that order", () => {
    expect(mintyEntryUrl({ mintyBase: FLASK, entityId: ENTITY, token: TOKEN })).toBe(
      `${FLASK}/entity/${ENTITY}/enter?token=${TOKEN}&return_origin=${ORIGIN}`,
    );
    expect(
      mintyEntryUrl({
        mintyBase: FLASK,
        entityId: ENTITY,
        token: TOKEN,
        next: "/entity/e1/petty-cash/reports",
      }),
    ).toBe(
      `${FLASK}/entity/${ENTITY}/enter?token=${TOKEN}&next=%2Fentity%2Fe1%2Fpetty-cash%2Freports&return_origin=${ORIGIN}`,
    );
  });

  it("encodes the id, the token and the path; the query is re-serialised (a space is '+')", () => {
    const built = mintyEntryUrl({
      mintyBase: FLASK,
      entityId: "e 2/3",
      token: "a+b/c=",
      next: "/a b",
    })!;
    expect(built).toBe(
      `${FLASK}/entity/e%202%2F3/enter?token=a%2Bb%2Fc%3D&next=%2Fa+b&return_origin=${ORIGIN}`,
    );
    expect(new URL(built).searchParams.get("next")).toBe("/a b");
  });

  it("an empty next is no next", () => {
    const url = new URL(
      mintyEntryUrl({ mintyBase: FLASK, entityId: ENTITY, token: TOKEN, next: "" })!,
    );
    expect(url.searchParams.has("next")).toBe(false);
  });

  it("is null with nothing to enter with - the app picks its fallback", () => {
    expect(mintyEntryUrl({ mintyBase: FLASK, entityId: "", token: TOKEN })).toBeNull();
    expect(mintyEntryUrl({ mintyBase: FLASK, entityId: ENTITY, token: null })).toBeNull();
    expect(mintyEntryUrl({ mintyBase: FLASK, entityId: undefined, token: undefined })).toBeNull();
  });

  it("takes the origin it is given", () => {
    const url = new URL(
      mintyEntryUrl({
        mintyBase: FLASK,
        entityId: ENTITY,
        token: TOKEN,
        origin: "https://o.test",
      })!,
    );
    expect(url.searchParams.get("return_origin")).toBe("https://o.test");
  });
});

describe("createHandoff - minty-web's shape (no company fallbacks)", () => {
  const clearAuth = vi.fn();
  const navigate = vi.fn<(url: string) => void>();
  const hub = createHandoff({
    flaskBase: () => FLASK,
    route: "/handoff/minty-web",
    clearAuth,
    home: "/entities",
  });

  beforeEach(() => {
    clearAuth.mockReset();
    hub._resetForTests(navigate);
    window.history.replaceState({}, "", "/subscription/billing?page=2");
  });
  afterEach(() => {
    navigate.mockReset();
    hub._resetForTests();
    window.history.replaceState({}, "", "/");
  });

  it("safeNext keeps a same-origin path and falls back to home, or the caller's fallback", () => {
    expect(hub.safeNext("/subscription/invoices")).toBe("/subscription/invoices");
    expect(hub.safeNext("//evil.com")).toBe("/entities");
    expect(hub.safeNext(null)).toBe("/entities");
    expect(hub.safeNext("https://evil.com", "/profile")).toBe("/profile");
    expect(hub.safeNext("", "/profile")).toBe("/profile");
  });

  it("handoffUrl orders next, entity_id, return_origin; an unsafe next becomes home", () => {
    expect(hub.handoffUrl("/subscription?a=1", "e1", "https://x.test")).toBe(
      `${FLASK}/handoff/minty-web?next=%2Fsubscription%3Fa%3D1&entity_id=e1&return_origin=https%3A%2F%2Fx.test`,
    );
    expect(hub.handoffUrl("//evil.com", undefined, "https://x.test")).toBe(
      `${FLASK}/handoff/minty-web?next=%2Fentities&return_origin=https%3A%2F%2Fx.test`,
    );
    expect(new URL(hub.handoffUrl()).searchParams.get("next")).toBe("/entities");
  });

  it("a company address in next names no company - /handoff/minty-web takes full ids only", () => {
    expect(
      new URL(hub.handoffUrl("/entity/360812e1/olive/settings/users")).searchParams.has(
        "entity_id",
      ),
    ).toBe(false);
  });

  it("redirectToHandoff goes once, clearing first; later calls do nothing until reset", () => {
    hub.redirectToHandoff();
    hub.redirectToHandoff("/profile", "e2");
    expect(clearAuth).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    const target = new URL(navigate.mock.calls[0][0]);
    expect(target.searchParams.get("next")).toBe("/subscription/billing?page=2");
    expect(target.searchParams.has("entity_id")).toBe(false);
    expect(target.searchParams.get("return_origin")).toBe(window.location.origin);

    hub._resetForTests(navigate);
    hub.redirectToHandoff("/profile", "e2");
    const again = new URL(navigate.mock.calls[1][0]);
    expect(again.searchParams.get("next")).toBe("/profile");
    expect(again.searchParams.get("entity_id")).toBe("e2");
  });

  it("clears the token BEFORE it navigates", () => {
    const order: string[] = [];
    clearAuth.mockImplementation(() => order.push("clear"));
    navigate.mockImplementation(() => order.push("go"));
    hub.redirectToHandoff();
    expect(order).toEqual(["clear", "go"]);
  });

  it("leaveTo navigates every time, the URL untouched, even while a hand-off is under way", () => {
    hub.redirectToHandoff();
    hub.leaveTo("https://checkout.example/x?y=1");
    hub.leaveTo("https://checkout.example/z");
    expect(navigate.mock.calls.map(([u]) => u).slice(1)).toEqual([
      "https://checkout.example/x?y=1",
      "https://checkout.example/z",
    ]);
    expect(clearAuth).toHaveBeenCalledTimes(1);
  });
});

describe("createHandoff - Petty Cash's shape (the cookie, then the address)", () => {
  let cookie: string | null = ENTITY;
  const navigate = vi.fn<(url: string) => void>();
  const pc = createHandoff({
    flaskBase: () => FLASK,
    route: "/handoff/petty-cash-web",
    clearAuth: () => {
      cookie = null;
    },
    companyFallback: () => cookie,
    companyFromNext: addressCompanyRef,
  });

  beforeEach(() => {
    cookie = ENTITY;
    pc._resetForTests(navigate);
  });
  afterEach(() => {
    navigate.mockReset();
    pc._resetForTests();
    window.history.replaceState({}, "", "/");
  });

  it("lands on / by default", () => {
    expect(pc.safeNext(null)).toBe("/");
    expect(new URL(pc.handoffUrl("javascript:alert(1)")).searchParams.get("next")).toBe("/");
  });

  it("handoffUrl takes the company from next's address when none is given, decoding its name", () => {
    expect(
      new URL(pc.handoffUrl("/entity/360812E1/olive-and-vine/petty-cash/reports")).searchParams.get(
        "entity_id",
      ),
    ).toBe("360812e1/olive-and-vine");
    expect(
      new URL(pc.handoffUrl("/entity/360812e1/vine-caf%C3%A9/petty-cash", "")).searchParams.get(
        "entity_id",
      ),
    ).toBe("360812e1/vine-café");
    expect(pc.handoffUrl("/landing")).toBe(
      `${FLASK}/handoff/petty-cash-web?next=%2Flanding&return_origin=${ORIGIN}`,
    );
  });

  it("redirectToHandoff names the cookie's company, read before it is cleared", () => {
    pc.redirectToHandoff("/entity/a1b2c3d4/other/petty-cash");
    expect(new URL(navigate.mock.calls[0][0]).searchParams.get("entity_id")).toBe(ENTITY);
    expect(cookie).toBeNull();

    // the cookie is gone: the next trip names the address's company
    pc._resetForTests(navigate);
    pc.redirectToHandoff("/entity/a1b2c3d4/other/petty-cash");
    expect(new URL(navigate.mock.calls[1][0]).searchParams.get("entity_id")).toBe("a1b2c3d4/other");
  });

  it("prefers the company it is given over the cookie's", () => {
    pc.redirectToHandoff("/x", "other-company");
    expect(new URL(navigate.mock.calls[0][0]).searchParams.get("entity_id")).toBe("other-company");
  });

  it("goes back to the page it is on, by the address's company when the cookie has none", () => {
    cookie = null;
    window.history.replaceState(
      null,
      "",
      "/entity/360812e1/olive-and-vine/petty-cash/reports?page=2",
    );
    pc.redirectToHandoff();
    const url = new URL(navigate.mock.calls[0][0]);
    expect(url.searchParams.get("next")).toBe(
      "/entity/360812e1/olive-and-vine/petty-cash/reports?page=2",
    );
    expect(url.searchParams.get("entity_id")).toBe("360812e1/olive-and-vine");
  });
});
