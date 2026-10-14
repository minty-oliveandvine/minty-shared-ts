// Preview sets (../previewSibling.ts): a page served on pr-<slug>-<app>.dailyminty.com links to
// the same set's other apps; every other host keeps the configured URL untouched.

import { describe, expect, it } from "vitest";

import { previewSetSlug, siblingUrl, withReturnOrigin } from "../previewSibling";

const PRW = "https://payment.dailyminty.com";

describe("siblingUrl", () => {
  it.each([
    ["my", "payment-request", "https://pr-feat-x-payment-request.dailyminty.com"],
    ["payment-request", "my", "https://pr-feat-x-my.dailyminty.com"],
    ["onboarding", "my", "https://pr-feat-x-my.dailyminty.com"],
    ["www", "onboarding", "https://pr-feat-x-onboarding.dailyminty.com"],
    ["petty-cash", "my", "https://pr-feat-x-my.dailyminty.com"],
    ["my", "petty-cash", "https://pr-feat-x-petty-cash.dailyminty.com"],
  ] as const)("maps pr-feat-x-%s to its %s sibling", (own, sub, expected) => {
    expect(siblingUrl(PRW, sub, `pr-feat-x-${own}.dailyminty.com`)).toBe(expected);
  });

  it("keeps the configured path and query", () => {
    expect(siblingUrl(`${PRW}/landing?x=1`, "payment-request", "pr-a-my.dailyminty.com")).toBe(
      "https://pr-a-payment-request.dailyminty.com/landing?x=1",
    );
  });

  it("reads the slot from the end, so a slug may contain an app name", () => {
    expect(siblingUrl(PRW, "my", "pr-fix-onboarding-copy-payment-request.dailyminty.com")).toBe(
      "https://pr-fix-onboarding-copy-my.dailyminty.com",
    );
  });

  it.each([
    ["production", "my.dailyminty.com"],
    ["development", "dev-my.dailyminty.com"],
    ["localhost", "localhost:3000"],
    ["127.0.0.1", "127.0.0.1:3000"],
    ["a vercel.app preview", "minty-web-git-feat-x-mintylive.vercel.app"],
    ["a look-alike domain", "pr-feat-x-my.dailyminty.com.evil.com"],
    ["a foreign parent", "pr-feat-x-my.evil.com"],
    ["a port", "pr-feat-x-my.dailyminty.com:443"],
    ["uppercase", "PR-FEAT-X-MY.DAILYMINTY.COM"],
    ["an empty slug", "pr--my.dailyminty.com"],
    ["a trailing hyphen", "pr-feat--my.dailyminty.com"],
    ["a 41-character slug", `pr-${"a".repeat(41)}-my.dailyminty.com`],
    ["an unknown app", "pr-feat-x-admin.dailyminty.com"],
    ["empty", ""],
    ["missing", undefined],
    ["null", null],
  ])("keeps the configured URL on %s", (_label, host) => {
    expect(siblingUrl(PRW, "my", host)).toBe(PRW);
  });

  it("accepts a 40-character slug", () => {
    const slug = "a".repeat(40);
    expect(siblingUrl(PRW, "my", `pr-${slug}-onboarding.dailyminty.com`)).toBe(
      `https://pr-${slug}-my.dailyminty.com`,
    );
  });
});

describe("previewSetSlug", () => {
  it("names the set a host belongs to", () => {
    expect(previewSetSlug("pr-feat-x-payment-request.dailyminty.com")).toBe("feat-x");
  });

  it("is null off a preview set", () => {
    expect(previewSetSlug("my.dailyminty.com")).toBeNull();
  });
});

describe("withReturnOrigin", () => {
  it("names the page's own origin, keeping the address's query", () => {
    const target = new URL(withReturnOrigin("https://minty.test/auth/email/handoff?t=abc"));
    expect(target.searchParams.get("t")).toBe("abc");
    expect(target.searchParams.get("return_origin")).toBe(window.location.origin);
  });

  it("takes the origin it is given - middleware runs on the server", () => {
    const target = new URL(
      withReturnOrigin("https://minty.test/entity", "https://pr-a-my.dailyminty.com"),
    );
    expect(target.searchParams.get("return_origin")).toBe("https://pr-a-my.dailyminty.com");
  });
});
