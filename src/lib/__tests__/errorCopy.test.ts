// How a failure becomes something a person can read (lib/errorCopy.ts). Ported from
// minty-payment-request-web's lib/__tests__/apiErrors.test.ts (checked against its
// docs/ERROR_COPY.md) and minty-onboarding-web's lib/__tests__/errorCopy.test.ts. Where the two
// disagreed the stricter rule won; the cases that changed say "stricter" in their title.

import { describe, expect, it } from "vitest";

import {
  HOUSE_FALLBACK,
  MAX_PROSE_LENGTH,
  STATUS_FALLBACK_MESSAGES,
  errorCopy,
  friendlyError,
  normalizeApiErrorDetail,
  readsAsProse,
  resolveApiErrorMessage,
  statusFallback,
} from "../errorCopy";

describe("the house fallback", () => {
  it("is this exact sentence", () => {
    expect(HOUSE_FALLBACK).toBe("Something went wrong on my end. Mind trying again?");
  });
});

describe("readsAsProse", () => {
  it("accepts a real sentence", () => {
    expect(readsAsProse("That invoice number is taken.")).toBe(true);
    expect(readsAsProse("Files need to be under 10MB.")).toBe(true);
    expect(readsAsProse("There was an error: try later.")).toBe(true);
    expect(readsAsProse("Please use https 443 next time.")).toBe(true);
    expect(readsAsProse("HTTP 50 is not a status.")).toBe(true);
  });

  it.each([
    ["a serialised body", '{"type":"missing"}'],
    ["an array", '["body","email"]'],
    ["markup (stricter: onboarding let it through)", "<html>Bad gateway</html>"],
    ["a stack", "Traceback (most recent call last)"],
    ["the word exception", "An exception was raised while saving"],
    ["a dunder", "__all__ must be a list"],
    ["a serialised null (payment-request's guard never fired)", "detail: null, status: 500"],
    ["a Python exception class (stricter)", "ValueError: bad input"],
    ["another one", "KeyError: entity_id"],
    ["Error:", "Error: boom"],
    ["lower-case error:", "error: lower case too"],
    ["a fetch failure", "Failed to fetch"],
    ["a Firefox fetch failure", "NetworkError when attempting to fetch resource."],
    ["a Safari fetch failure", "Load failed"],
    ["a JSON parse failure", "Unexpected token '<', \"<!DOCTYPE \" is not valid JSON"],
    ["a truncated JSON body", "Unexpected end of JSON input"],
    ["a runtime error", "x.map is not a function"],
    ["an undefined name", "foo is not defined"],
    ["a property read", "Cannot read properties of undefined (reading 'id')"],
    ["an HTTP status", "HTTP 502 from upstream"],
    ["an HTTP status with no space (stricter)", "Server said http500"],
    ["an HTTP status line", "HTTP/1.1 500 went wrong"],
    ["an axios status", "Request failed with status code 500"],
    ["[object Object]", "Got [object Object] back"],
  ])("refuses %s", (_label, text) => {
    expect(readsAsProse(text)).toBe(false);
  });

  it.each(["invalid_state", "bill.not_found", "not-found", "auth.expired", "e:42", "abc", "404"])(
    "refuses the bare code %s",
    (code) => {
      expect(readsAsProse(code)).toBe(false);
    },
  );

  it("refuses any single word, whatever its case (stricter: onboarding let these through)", () => {
    expect(readsAsProse("Forbidden")).toBe(false);
    expect(readsAsProse("INVALID_STATE")).toBe(false);
    expect(readsAsProse("ERR-1234")).toBe(false);
  });

  it("refuses a bare reason phrase on its own - HTTP/2 sends no statusText to compare with", () => {
    expect(readsAsProse("Internal Server Error")).toBe(false);
    expect(readsAsProse("Bad Gateway")).toBe(false);
    expect(readsAsProse("502 Bad Gateway")).toBe(false);
    expect(readsAsProse("Service Unavailable.")).toBe(false);
    expect(readsAsProse("Not Found")).toBe(false);
    expect(readsAsProse("The page was not found here.")).toBe(true);
  });

  it("accepts 200 characters once trimmed and refuses 201 (stricter: payment-request allowed 300)", () => {
    expect(MAX_PROSE_LENGTH).toBe(200);
    const ok = "A " + "x".repeat(198);
    expect(readsAsProse(`   ${ok}   `)).toBe(true);
    expect(readsAsProse(`${ok}x`)).toBe(false);
  });

  it("refuses an empty or blank string", () => {
    expect(readsAsProse("")).toBe(false);
    expect(readsAsProse("   ")).toBe(false);
  });
});

describe("normalizeApiErrorDetail", () => {
  it("falls back for nothing at all", () => {
    expect(normalizeApiErrorDetail(null, "fallback")).toBe("fallback");
    expect(normalizeApiErrorDetail(undefined, "fallback")).toBe("fallback");
    expect(normalizeApiErrorDetail("", "fallback")).toBe("fallback");
  });

  it("passes a string through untouched", () => {
    expect(normalizeApiErrorDetail("  Taken.  ", "fallback")).toBe("  Taken.  ");
  });

  it("reduces django-ninja's schema failure to its msg fields", () => {
    const detail = [
      { type: "missing", loc: ["body", "email"], msg: "Field required" },
      { type: "value_error", loc: ["body", "amount"], msg: "Amount must be positive" },
    ];
    expect(normalizeApiErrorDetail(detail, "fallback")).toBe(
      "Field required; Amount must be positive",
    );
  });

  it("takes strings out of a list, dropping blanks and anything unreadable", () => {
    expect(normalizeApiErrorDetail(["Name is empty.", "  ", 3, null, "Email."], "f")).toBe(
      "Name is empty.; Email.",
    );
    expect(normalizeApiErrorDetail([{ type: "missing" }], "f")).toBe("f");
    expect(normalizeApiErrorDetail([], "f")).toBe("f");
  });

  it("keeps a field-error map's sentences and drops the keys", () => {
    expect(
      normalizeApiErrorDetail(
        { email: ["This field is required."], amount: "Must be positive." },
        "f",
      ),
    ).toBe("This field is required.; Must be positive.");
    expect(normalizeApiErrorDetail({ email: [{ code: "required" }] }, "f")).toBe("f");
    expect(normalizeApiErrorDetail({}, "f")).toBe("f");
  });

  it("falls back for a number or a boolean", () => {
    expect(normalizeApiErrorDetail(422, "f")).toBe("f");
    expect(normalizeApiErrorDetail(true, "f")).toBe("f");
  });
});

describe("errorCopy", () => {
  it("passes a sentence through, trimmed", () => {
    expect(errorCopy("  That company name is taken.  ")).toBe("That company name is taken.");
  });

  it("falls back for nothing, a blank, a number, a boolean", () => {
    for (const value of [null, undefined, "", "   ", 42, true]) {
      expect(errorCopy(value)).toBe(HOUSE_FALLBACK);
    }
  });

  it("uses the caller's fallback, and an empty one still means the house line", () => {
    expect(errorCopy(null, "Custom.")).toBe("Custom.");
    expect(errorCopy(null, "")).toBe(HOUSE_FALLBACK);
  });

  it("joins a list, then judges the whole", () => {
    expect(errorCopy(["Name is empty.", "Email is empty."])).toBe(
      "Name is empty.; Email is empty.",
    );
    expect(errorCopy(["Name is empty.", "Failed to fetch"])).toBe(HOUSE_FALLBACK);
  });

  it("reads a field map's sentences (onboarding fell back for every object)", () => {
    expect(errorCopy({ email: ["That email is already in use."] })).toBe(
      "That email is already in use.",
    );
    expect(errorCopy({ detail: "x" })).toBe(HOUSE_FALLBACK);
  });
});

describe("friendlyError", () => {
  it("reads error, then detail, then message", () => {
    expect(friendlyError({ error: "Error sentence here.", message: "Message here." })).toBe(
      "Error sentence here.",
    );
    expect(friendlyError({ detail: "Detail sentence here.", message: "Message here." })).toBe(
      "Detail sentence here.",
    );
    expect(friendlyError({ message: "Your code has expired." })).toBe("Your code has expired.");
  });

  it("judges the first field with text - a code in error is not rescued by message", () => {
    expect(friendlyError({ error: "invalid_state", message: "A real sentence." })).toBe(
      HOUSE_FALLBACK,
    );
  });

  it("skips an empty or null field (onboarding fell back on an empty error)", () => {
    expect(friendlyError({ error: "", message: "A real sentence." })).toBe("A real sentence.");
    expect(friendlyError({ error: null, message: "A real sentence." })).toBe("A real sentence.");
  });

  it("flattens a list or a pydantic detail", () => {
    expect(friendlyError({ error: ["One thing.", "Two things."] })).toBe("One thing.; Two things.");
    expect(friendlyError({ detail: [{ loc: ["body"], msg: "Field required here" }] })).toBe(
      "Field required here",
    );
  });

  it("falls back for no body, an empty one, a text body or a list", () => {
    expect(friendlyError(null)).toBe(HOUSE_FALLBACK);
    expect(friendlyError(undefined)).toBe(HOUSE_FALLBACK);
    expect(friendlyError({})).toBe(HOUSE_FALLBACK);
    expect(friendlyError("Bad Gateway page text")).toBe(HOUSE_FALLBACK);
    expect(friendlyError(["A sentence here."])).toBe(HOUSE_FALLBACK);
    expect(friendlyError(null, "I couldn't save those. Mind trying again?")).toBe(
      "I couldn't save those. Mind trying again?",
    );
  });
});

describe("statusFallback", () => {
  it.each([
    [403, "You don't have access to that."],
    [404, "I couldn't find that."],
    [408, "That took too long to come back. Mind trying again?"],
    [409, "Someone else changed that first. Refresh and try again."],
    [429, "That's a lot of requests at once. Give it a moment and try again."],
    [500, "Something went wrong on my end. Mind trying again?"],
    [502, "I couldn't reach the server just now. Mind trying again?"],
    [503, "The server is busy right now. Mind trying again in a moment?"],
    [504, "The server took too long to answer. Mind trying again?"],
  ])("has its own copy for %i", (status, copy) => {
    expect(statusFallback(status)).toBe(copy);
    expect(STATUS_FALLBACK_MESSAGES[status]).toBe(copy);
  });

  it("is the house line for 422 and any status without copy", () => {
    expect(statusFallback(422)).toBe(HOUSE_FALLBACK);
    expect(statusFallback(418)).toBe(HOUSE_FALLBACK);
  });
});

describe("resolveApiErrorMessage", () => {
  it("shows the server's own sentence when it is one", () => {
    expect(resolveApiErrorMessage(409, "Someone paid this bill a moment ago.", "Conflict")).toBe(
      "Someone paid this bill a moment ago.",
    );
    expect(resolveApiErrorMessage(422, "That invoice number already exists here.")).toBe(
      "That invoice number already exists here.",
    );
  });

  it("stands in the status copy for a reason phrase, with or without statusText", () => {
    expect(resolveApiErrorMessage(500, "Internal Server Error", "Internal Server Error")).toBe(
      HOUSE_FALLBACK,
    );
    // the HTTP/2 hole payment-request pinned: statusText is "" there
    expect(resolveApiErrorMessage(502, "Bad Gateway", "")).toBe(
      "I couldn't reach the server just now. Mind trying again?",
    );
    expect(resolveApiErrorMessage(404, null, "")).toBe("I couldn't find that.");
  });

  it("refuses a sentence that is exactly the statusText", () => {
    expect(resolveApiErrorMessage(503, "Down for a bit", "Down for a bit")).toBe(
      "The server is busy right now. Mind trying again in a moment?",
    );
  });

  it("falls back for machinery and shows a flattened schema failure that reads as prose", () => {
    expect(resolveApiErrorMessage(422, "invalid_state", "")).toBe(HOUSE_FALLBACK);
    expect(resolveApiErrorMessage(422, [{ type: "missing", loc: ["body"] }])).toBe(HOUSE_FALLBACK);
    expect(resolveApiErrorMessage(422, [{ loc: ["body", "email"], msg: "Field required" }])).toBe(
      "Field required",
    );
  });
});
