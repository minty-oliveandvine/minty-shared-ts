// The module token and its cookies (lib/auth.ts). Ported from lib/__tests__/auth.test.ts in
// minty-web, minty-payment-request-web and minty-petty-cash-web, and payment-request's
// moduleClaims.test.tsx: the cookie names come from the app's prefix, the lifetime from the token
// (or a fixed maxAge), and only a literal false turns a module off.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FALLBACK_MAX_AGE_SECONDS,
  createCookieAuth,
  decodeJwtPayload,
  isTokenExpired,
  isTokenExpiringSoon,
  moduleClaims,
  secondsUntilExpiry,
} from "../auth";

/** base64url without padding, of UTF-8 text - what a JWT segment is. */
function b64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const jwt = (claims: unknown) =>
  `${b64url('{"alg":"HS256"}')}.${b64url(JSON.stringify(claims))}.sig`;

const NOW = Date.UTC(2026, 9, 22, 9, 0, 0);
const NOW_S = NOW / 1000;

/** Every string written to document.cookie while `fn` runs. */
function writes(fn: () => void): string[] {
  const spy = vi.spyOn(document, "cookie", "set");
  fn();
  const out = spy.mock.calls.map(([v]) => String(v));
  spy.mockRestore();
  return out;
}

describe("decodeJwtPayload", () => {
  it("reads an unpadded base64url payload at every padding length, - and _ included", () => {
    for (const pad of ["a", "ab", "abc", "abcd"]) {
      expect(decodeJwtPayload(jwt({ pad }))?.pad).toBe(pad);
    }
    const payload = { s: "??>???", n: 1 };
    expect(b64url(JSON.stringify(payload))).toMatch(/[-_]/);
    expect(decodeJwtPayload(jwt(payload))).toEqual(payload);
  });

  it("reads the payload as UTF-8 (the apps' copies gave mojibake for non-ASCII)", () => {
    expect(decodeJwtPayload(jwt({ name: "Olive & Vine 橄欖" }))?.name).toBe("Olive & Vine 橄欖");
  });

  it.each([
    ["two parts", "a.b"],
    ["four parts", "a.b.c.d"],
    ["an empty string", ""],
    ["nonsense", "not-a-token"],
    ["an undecodable payload", "h.%%%.s"],
    ["a payload that is not JSON", `h.${b64url("not json")}.s`],
    ["a list", jwt([1, 2])],
    ["null", jwt(null)],
    ["a number", jwt(5)],
    ["a string", jwt("text")],
  ])("is null for %s, never throwing", (_label, token) => {
    expect(decodeJwtPayload(token)).toBeNull();
  });

  it("is null for no token at all", () => {
    expect(decodeJwtPayload(null)).toBeNull();
    expect(decodeJwtPayload(undefined)).toBeNull();
  });

  it("does not check the signature - any third part will do", () => {
    expect(decodeJwtPayload(`h.${b64url('{"a":1}')}.`)).toEqual({ a: 1 });
  });
});

describe("secondsUntilExpiry", () => {
  it("is the whole seconds to exp, floored, at least 1", () => {
    expect(secondsUntilExpiry(jwt({ exp: NOW_S + 99.5 }), NOW)).toBe(99);
    expect(secondsUntilExpiry(jwt({ exp: NOW_S }), NOW)).toBe(1);
    expect(secondsUntilExpiry(jwt({ exp: 1 }), NOW)).toBe(1);
  });

  it("is Flask's 30 minutes for no exp, a non-number exp, or no token", () => {
    expect(FALLBACK_MAX_AGE_SECONDS).toBe(1800);
    expect(secondsUntilExpiry(jwt({}), NOW)).toBe(1800);
    expect(secondsUntilExpiry(jwt({ exp: String(NOW_S + 600) }), NOW)).toBe(1800);
    expect(secondsUntilExpiry("garbage", NOW)).toBe(1800);
    expect(secondsUntilExpiry(null, NOW)).toBe(1800);
  });

  it("reads the clock when not given one", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    expect(secondsUntilExpiry(jwt({ exp: NOW_S + 600 }))).toBe(600);
  });
});

describe("isTokenExpired", () => {
  it("is true with no token", () => {
    expect(isTokenExpired(null, 5, NOW)).toBe(true);
    expect(isTokenExpired("", 5, NOW)).toBe(true);
  });

  it("is false for a token with no readable exp - it cannot tell, so it does not guess", () => {
    expect(isTokenExpired(jwt({ user_id: "u1" }), 5, NOW)).toBe(false);
    expect(isTokenExpired("not-a-jwt", 5, NOW)).toBe(false);
  });

  it("allows 5 seconds of clock skew past exp by default", () => {
    expect(isTokenExpired(jwt({ exp: NOW_S - 4 }), undefined, NOW)).toBe(false);
    expect(isTokenExpired(jwt({ exp: NOW_S - 6 }), undefined, NOW)).toBe(true);
    expect(isTokenExpired(jwt({ exp: NOW_S + 60 }), undefined, NOW)).toBe(false);
  });

  it("takes a leeway of its own", () => {
    expect(isTokenExpired(jwt({ exp: NOW_S - 30 }), 60, NOW)).toBe(false);
    expect(isTokenExpired(jwt({ exp: NOW_S - 1 }), 0, NOW)).toBe(true);
  });
});

describe("isTokenExpiringSoon", () => {
  it("is true inside the default two minutes, and for a lapsed token", () => {
    expect(isTokenExpiringSoon(jwt({ exp: NOW_S + 121 }), undefined, NOW)).toBe(false);
    expect(isTokenExpiringSoon(jwt({ exp: NOW_S + 119 }), undefined, NOW)).toBe(true);
    expect(isTokenExpiringSoon(jwt({ exp: NOW_S - 60 }), undefined, NOW)).toBe(true);
    expect(isTokenExpiringSoon(jwt({ exp: NOW_S + 300 }), 600, NOW)).toBe(true);
  });

  it("is false with no token, a malformed one or no numeric exp", () => {
    expect(isTokenExpiringSoon(null, 120, NOW)).toBe(false);
    expect(isTokenExpiringSoon("nonsense", 120, NOW)).toBe(false);
    expect(isTokenExpiringSoon(jwt({ exp: "soon" }), 120, NOW)).toBe(false);
  });
});

describe("moduleClaims", () => {
  it.each([
    [
      { petty_cash_enabled: true, billing_enabled: false },
      { pettyCash: true, billing: false },
    ],
    [
      { petty_cash_enabled: false, billing_enabled: false },
      { pettyCash: false, billing: false },
    ],
    [
      { petty_cash_enabled: 0, billing_enabled: "false" },
      { pettyCash: true, billing: true },
    ],
    [
      { petty_cash_enabled: null, billing_enabled: "" },
      { pettyCash: true, billing: true },
    ],
    [{ role: "admin" }, { pettyCash: true, billing: true }],
  ])("reads %j as %j - only a literal false turns a module off", (claims, expected) => {
    expect(moduleClaims(jwt(claims))).toEqual(expected);
    expect(moduleClaims(claims)).toEqual(expected);
  });

  it("is both on for no token or one that is not a JWT", () => {
    expect(moduleClaims(null)).toEqual({ pettyCash: true, billing: true });
    expect(moduleClaims(undefined)).toEqual({ pettyCash: true, billing: true });
    expect(moduleClaims("opaque")).toEqual({ pettyCash: true, billing: true });
  });
});

describe("createCookieAuth", () => {
  const auth = createCookieAuth({ prefix: "minty" });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    auth.clearAuth();
    vi.useRealTimers();
  });

  it("names the three cookies from the prefix", () => {
    expect(auth.cookieNames).toEqual({
      token: "minty_token",
      entityId: "minty_entity_id",
      entityName: "minty_entity_name",
    });
    expect(createCookieAuth({ prefix: "petty_cash" }).cookieNames.token).toBe("petty_cash_token");
  });

  it("refuses to be built without a prefix or with a nonsense maxAge", () => {
    expect(() => createCookieAuth({ prefix: "" })).toThrow();
    expect(() => createCookieAuth({ prefix: "x", maxAge: 0 })).toThrow();
    expect(() => createCookieAuth({ prefix: "x", maxAge: 1.5 })).toThrow();
  });

  it("writes all three encoded, for the token's own lifetime, on / and SameSite=Lax", () => {
    const token = jwt({ exp: NOW_S + 600.9 });
    const written = writes(() =>
      auth.setAuth({ token, entityId: "e/1", entityName: "Olive & Vine; Ltd" }),
    );
    const opts = "path=/;max-age=600;SameSite=Lax";
    expect(written).toEqual([
      `minty_token=${encodeURIComponent(token)};${opts}`,
      `minty_entity_id=e%2F1;${opts}`,
      `minty_entity_name=Olive%20%26%20Vine%3B%20Ltd;${opts}`,
    ]);
    expect(auth.getAuth()).toEqual({ token, entityId: "e/1", entityName: "Olive & Vine; Ltd" });
  });

  it("gives a token with no readable exp Flask's 30 minutes, and a lapsed one 1 second", () => {
    expect(
      writes(() => auth.setAuth({ token: "not-a-jwt", entityId: "", entityName: "" }))[0],
    ).toBe("minty_token=not-a-jwt;path=/;max-age=1800;SameSite=Lax");
    expect(
      writes(() =>
        auth.setAuth({ token: jwt({ exp: NOW_S - 60 }), entityId: "", entityName: "" }),
      )[0],
    ).toContain(";max-age=1;");
  });

  it("uses a fixed maxAge when given one, whatever the token says", () => {
    const billing = createCookieAuth({ prefix: "billing", maxAge: 60 * 60 * 8 });
    const written = writes(() =>
      billing.setAuth({ token: jwt({ exp: NOW_S + 60 }), entityId: "e", entityName: "n" }),
    );
    expect(written).toHaveLength(3);
    for (const w of written) expect(w).toContain(";path=/;max-age=28800;SameSite=Lax");
    billing.clearAuth();
  });

  it("adds Secure on https", () => {
    const real = window;
    vi.stubGlobal("window", { location: { protocol: "https:" } });
    let written: string[];
    try {
      written = writes(() => auth.setAuth({ token: "t", entityId: "e", entityName: "n" }));
    } finally {
      vi.unstubAllGlobals();
    }
    expect(window).toBe(real);
    for (const w of written)
      expect(w.endsWith(";path=/;max-age=1800;SameSite=Lax;Secure")).toBe(true);
  });

  it("clears the three with max-age=0", () => {
    auth.setAuth({ token: "t1", entityId: "e1", entityName: "Co" });
    expect(writes(() => auth.clearAuth())).toEqual([
      "minty_token=;path=/;max-age=0",
      "minty_entity_id=;path=/;max-age=0",
      "minty_entity_name=;path=/;max-age=0",
    ]);
    expect(auth.getAuth()).toBeNull();
  });

  it("is signed out with no token cookie, or an EMPTY one beside a company", () => {
    expect(auth.getAuth()).toBeNull();
    auth.setAuth({ token: "", entityId: "e1", entityName: "Co" });
    expect(auth.getAuth()).toBeNull();
  });

  it("answers empty strings for missing company cookies", () => {
    document.cookie = "minty_token=t1;path=/";
    expect(auth.getAuth()).toEqual({ token: "t1", entityId: "", entityName: "" });
  });

  it("splits a cookie on its FIRST '=' so a padded value survives", () => {
    document.cookie = "minty_token=a.b.c==;path=/";
    expect(auth.getAuth()?.token).toBe("a.b.c==");
  });

  it("keeps a cookie it cannot URI-decode as it stands", () => {
    document.cookie = "minty_token=100%;path=/";
    expect(auth.getAuth()?.token).toBe("100%");
  });

  it("never reads another app's cookies", () => {
    createCookieAuth({ prefix: "billing" }).setAuth({
      token: "other",
      entityId: "x",
      entityName: "",
    });
    expect(auth.getAuth()).toBeNull();
    createCookieAuth({ prefix: "billing" }).clearAuth();
  });

  it("snapshot: the same object while the cookies are unchanged, a new one after, null when out", () => {
    auth.setAuth({ token: "a.b.c", entityId: "id-1", entityName: "Olive" });
    const first = auth.getAuthSnapshot();
    expect(first).toEqual({ token: "a.b.c", entityId: "id-1", entityName: "Olive" });
    expect(auth.getAuthSnapshot()).toBe(first);
    expect(auth.getAuth()).not.toBe(auth.getAuth());
    auth.setAuth({ token: "a.b.c", entityId: "id-2", entityName: "Vine" });
    const second = auth.getAuthSnapshot();
    expect(second).not.toBe(first);
    expect(second?.entityId).toBe("id-2");
    auth.clearAuth();
    expect(auth.getAuthSnapshot()).toBeNull();
  });
});
