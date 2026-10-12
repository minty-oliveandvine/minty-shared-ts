// The `next` rule (../safeNext.ts): only a path on this origin survives. The off-site
// spellings below each landed on https://evil.com/ under the old startsWith check.
//
// Each app's own wrapper around this (minty-web's lib/handoff.ts safeNext, which falls back
// to the hub home) is tested in that app - the fallback is its answer, not the package's.

import { describe, expect, it } from "vitest";

import { safeNextPath } from "../safeNext";

describe("safeNextPath", () => {
  it.each(["/entities", "/subscription/entities/abc/modules?from=bills", "/profile#section"])(
    "keeps the same-origin path %s",
    (path) => {
      expect(safeNextPath(path, "/fallback")).toBe(path);
    },
  );

  it.each([
    ["protocol-relative", "//evil.com"],
    ["backslash", "/\\evil.com"],
    ["tab", "/\t/evil.com"],
    ["newline", "/\n/evil.com"],
    ["carriage return", "/\r/evil.com"],
    ["absolute URL", "https://evil.com"],
    ["javascript:", "javascript:alert(1)"],
    ["relative", "evil.com"],
    ["empty", ""],
  ])("refuses %s", (_label, raw) => {
    expect(safeNextPath(raw, "/fallback")).toBe("/fallback");
  });

  it("refuses null and undefined", () => {
    expect(safeNextPath(null, "/fallback")).toBe("/fallback");
    expect(safeNextPath(undefined, "/fallback")).toBe("/fallback");
  });
});
