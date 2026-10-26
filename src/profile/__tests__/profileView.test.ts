// My Profile's rules: the plan under the company, and what a save sends.

import { describe, expect, it } from "vitest";

import { EMAIL_ASCII_HINT } from "../../lib/emailInput";
import { SCOPED, SUPERMINTY } from "../fixtures";
import { changesFrom, EMAIL_INVALID, EMAIL_REQUIRED, planLabel } from "../profileView";

describe("profileView", () => {
  it("names the plan: SuperMinty for both modules, else the one module, else nothing", () => {
    expect(planLabel(SUPERMINTY.entity)).toMatchObject({ text: "SuperMinty", cat: true });
    expect(planLabel(SCOPED.entity)).toMatchObject({ text: "Payment Request", cat: false });
    expect(planLabel({ ...SCOPED.entity!, modules: ["PETTY_CASH"] })).toMatchObject({
      text: "Petty Cash",
      cat: false,
    });
    expect(planLabel({ ...SCOPED.entity!, modules: [] })).toBeNull();
    expect(planLabel(null)).toBeNull();
  });

  it("sends only what changed, and refuses an emptied or non-English email before anything is sent", () => {
    const saved = { first_name: "John", last_name: "Birmingha", email: "j@x.com" };
    expect(changesFrom({ ...saved }, saved)).toEqual({ changes: {}, error: null });
    expect(changesFrom({ ...saved, first_name: " Jon " }, saved)).toEqual({
      changes: { first_name: " Jon " },
      error: null,
    });
    // trailing spaces alone are no change: the server trims what it stores
    expect(changesFrom({ ...saved, last_name: "Birmingha " }, saved).changes).toEqual({});
    expect(changesFrom({ ...saved, email: "   " }, saved)).toEqual({
      changes: {},
      error: EMAIL_REQUIRED,
    });
    expect(changesFrom({ ...saved, email: "jé@x.com" }, saved)).toEqual({
      changes: {},
      error: EMAIL_ASCII_HINT,
    });
  });

  it("refuses an email that isn't shaped like one (v0.10); the names stay optional", () => {
    const saved = { first_name: "John", last_name: "Birmingha", email: "j@x.com" };
    expect(EMAIL_INVALID).toBe("That email address doesn't look right.");
    for (const email of ["jx.com", "j@x", "j@", "@x.com", "j@@x.com"]) {
      expect(changesFrom({ ...saved, email }, saved)).toEqual({
        changes: {},
        error: EMAIL_INVALID,
      });
    }
    expect(changesFrom({ ...saved, email: "a+b@sub.domain.museum" }, saved)).toEqual({
      changes: { email: "a+b@sub.domain.museum" },
      error: null,
    });
    expect(changesFrom({ ...saved, first_name: "", last_name: "" }, saved)).toEqual({
      changes: { first_name: "", last_name: "" },
      error: null,
    });
  });
});
