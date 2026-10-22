// A service's base URL from the environment (lib/env.ts). Ported from the url() pins in
// minty-web's and minty-payment-request-web's lib/__tests__/envDefaults.test.ts, minty-petty-cash-web's
// lib/__tests__/env.test.ts and minty-onboarding-web's flaskBase/apiRoutes tests, with one rule:
// trim, strip every trailing slash, and a blank value is the dev port locally but an error in a
// production build (CLAUDE.md: no silent defaults for required config).

import { afterEach, describe, expect, it, vi } from "vitest";

import { envUrl } from "../env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("envUrl with a value", () => {
  it("trims, then strips EVERY trailing slash", () => {
    expect(envUrl("X_URL", "  https://pay.example.com///  ", "http://localhost:3020")).toBe(
      "https://pay.example.com",
    );
    expect(envUrl("X_URL", "https://flask.example/ ", "http://localhost:8000")).toBe(
      "https://flask.example",
    );
  });

  it("keeps a path prefix, minus its trailing slashes", () => {
    expect(envUrl("X_URL", "https://minty.test/base//", "http://localhost:8000")).toBe(
      "https://minty.test/base",
    );
  });

  it("does not validate: anything else stands as written", () => {
    expect(envUrl("X_URL", "not a url", "http://localhost:8000")).toBe("not a url");
  });

  it("uses the value in production too", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(envUrl("X_URL", "https://accounts-api.dailyminty.com/", "http://localhost:8000")).toBe(
      "https://accounts-api.dailyminty.com",
    );
  });
});

describe("envUrl with no value", () => {
  it.each([
    ["unset", undefined],
    ["null", null],
    ["empty", ""],
    ["whitespace", "   "],
    ["a lone slash", "/"],
    ["only slashes and spaces", " /// "],
  ])("falls back to the dev port in development when %s", (_label, raw) => {
    vi.stubEnv("NODE_ENV", "development");
    expect(envUrl("X_URL", raw, "http://localhost:8001")).toBe("http://localhost:8001");
  });

  it("falls back in tests", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(envUrl("X_URL", undefined, "http://localhost:8001")).toBe("http://localhost:8001");
  });

  it("cleans the fallback the same way", () => {
    expect(envUrl("X_URL", "", " http://localhost:8001/ ")).toBe("http://localhost:8001");
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["whitespace", "   "],
    ["a lone slash", "/"],
  ])("THROWS in production when %s, naming the variable", (_label, raw) => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => envUrl("SUBSCRIPTION_API_URL", raw, "http://localhost:8001")).toThrow(
      /^SUBSCRIPTION_API_URL is not set\./,
    );
  });
});
