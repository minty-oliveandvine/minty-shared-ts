// How a company is written into an address (lib/companyRef.ts). Three callers depend on this
// agreeing with Flask's blueprints/shared/entity_ref.py::slugify_name: middleware.ts,
// lib/companyPages.ts and e2e/helpers.ts. A mismatch only costs a redirect, which is exactly
// why nothing would notice it without these.

import { describe, expect, it } from "vitest";

import {
  SHORT_ID_LENGTH,
  addressCompanyRef,
  billsUrl,
  companyPath,
  companyRef,
  companyRefFromPath,
  paymentRequestSettingsUrl,
  pettyCashSettingsUrl,
  settingsSectionUrl,
  shortIdOf,
  slugifyName,
} from "../companyRef";

describe("shortIdOf", () => {
  it("is the first eight characters, lowercased", () => {
    expect(SHORT_ID_LENGTH).toBe(8);
    expect(shortIdOf("360812E1-9F3A-4C21-8E5B-1A2B3C4D5E6F")).toBe("360812e1");
  });

  it("takes what there is when the id is shorter", () => {
    expect(shortIdOf("abc")).toBe("abc");
    expect(shortIdOf("")).toBe("");
  });
});

describe("slugifyName", () => {
  it.each([
    ["Olive & Vine", "olive-and-vine"],
    ["Olive and Vine", "olive-and-vine"],
    ["E2E Petty Cash Shop", "e2e-petty-cash-shop"],
    ["  Spaced   Out  ", "spaced-out"],
    ["Punctuation!!! Here???", "punctuation-here"],
    ["Hyphen--Already", "hyphen-already"],
  ])("turns %s into %s", (name, slug) => {
    expect(slugifyName(name)).toBe(slug);
  });

  it("keeps letters and digits of any script", () => {
    expect(slugifyName("橄欖 Vine 3")).toBe("橄欖-vine-3");
  });

  it("falls back to 'company' when nothing is left", () => {
    expect(slugifyName(null)).toBe("company");
    expect(slugifyName(undefined)).toBe("company");
    expect(slugifyName("")).toBe("company");
    expect(slugifyName("!!!")).toBe("company");
  });

  it("caps the slug at 60 characters and never ends on a hyphen", () => {
    const slug = slugifyName(`${"a".repeat(59)} tail`);
    expect(slug).toHaveLength(59);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("companyRef", () => {
  it("is the short id and the slug, each ready for a path", () => {
    expect(companyRef("360812e1-9f3a-4c21", "Olive & Vine")).toBe("360812e1/olive-and-vine");
  });

  it("percent-encodes a non-ASCII slug", () => {
    expect(companyRef("360812e1", "橄欖")).toBe(`360812e1/${encodeURIComponent("橄欖")}`);
  });
});

const ID = "360812e1-9f94-46a3-aa31-347e21afde8e";

describe("companyPath", () => {
  // minty-web's lib/hubPaths.ts companyPath, minty-payment-request-web's companyBase and
  // minty-petty-cash-web's pettyCashHome / settingsHref, as one builder.
  it("is /entity/<shortid>/<slug>, then the segments", () => {
    expect(companyPath(ID, "Olive & Vine")).toBe("/entity/360812e1/olive-and-vine");
    expect(companyPath(ID, "Olive & Vine", "settings", "users")).toBe(
      "/entity/360812e1/olive-and-vine/settings/users",
    );
    expect(companyPath("360812E1-9f94", "", "petty-cash")).toBe(
      "/entity/360812e1/company/petty-cash",
    );
  });

  it("joins segments with exactly one slash, whatever slashes they carry, and skips empty ones", () => {
    expect(companyPath(ID, "Co", "/settings/users")).toBe("/entity/360812e1/co/settings/users");
    expect(companyPath(ID, "Co", "/settings/", "", "/users")).toBe(
      "/entity/360812e1/co/settings/users",
    );
    expect(companyPath(ID, "Co", "x")).toBe("/entity/360812e1/co/x");
  });

  it("encodes the slug, not the segments", () => {
    expect(companyPath(ID, "Café Ünï", "petty-cash")).toBe(
      `/entity/360812e1/${encodeURIComponent("café-ünï")}/petty-cash`,
    );
    expect(companyPath(ID, "Co", "payment-request", "PR 1")).toBe(
      "/entity/360812e1/co/payment-request/PR 1",
    );
  });
});

describe("companyRefFromPath and addressCompanyRef", () => {
  // minty-petty-cash-web's lib/companyPages.ts rules: exactly 8 hex characters at the start, the
  // short id lowercased, the name decoded (a malformed escape kept as written).
  it.each([
    ["/entity/360812e1/olive-and-vine/petty-cash", "360812e1", "olive-and-vine"],
    ["/entity/360812E1/olive-and-vine", "360812e1", "olive-and-vine"],
    ["/entity/360812e1/vine-caf%C3%A9/petty-cash?x=1", "360812e1", "vine-café"],
    ["/entity/360812e1/bad%E0%A4%A/petty-cash", "360812e1", "bad%E0%A4%A"],
    ["/entity/360812e1/olive#top", "360812e1", "olive"],
    ["/entity/360812e1/olive?x=1", "360812e1", "olive"],
    ["/entity/360812e1/olive/", "360812e1", "olive"],
    ["/entity/ABCDEF12/Name%20Here/x", "abcdef12", "Name Here"],
  ])("reads %s", (path, shortId, slug) => {
    expect(companyRefFromPath(path)).toEqual({ shortId, slug });
    expect(addressCompanyRef(path)).toBe(`${shortId}/${slug}`);
  });

  it.each([
    "/",
    "/landing",
    "/entity/not-hex1/x",
    "/entity/360812e1",
    "/entity/360812e1/",
    "/entity/360812e1a/olive",
    "/entity/360812e/olive",
    "entity/360812e1/olive",
    "/x/entity/360812e1/olive",
    "/entities/360812e1/olive",
  ])("finds no company in %s", (path) => {
    expect(companyRefFromPath(path)).toBeNull();
    expect(addressCompanyRef(path)).toBeNull();
  });
});

describe("the settings pills' cross-app addresses", () => {
  const FLASK = "http://flask.test";
  const BACK = `return_origin=${encodeURIComponent(window.location.origin)}`;

  it("reaches minty-web's sections through /handoff/minty-web, scoped to the company", () => {
    expect(settingsSectionUrl(FLASK, ID, "Olive & Vine", "users")).toBe(
      `${FLASK}/handoff/minty-web?next=%2Fentity%2F360812e1%2Folive-and-vine%2Fsettings%2Fusers&entity_id=${ID}&${BACK}`,
    );
    for (const section of ["integration", "modules"] as const) {
      const url = new URL(settingsSectionUrl(FLASK, ID, "", section));
      expect(url.searchParams.get("next")).toBe(`/entity/360812e1/company/settings/${section}`);
      expect(url.searchParams.get("entity_id")).toBe(ID);
      expect(url.searchParams.has("token")).toBe(false);
    }
  });

  it("drops a trailing slash on the base - never a double slash", () => {
    expect(settingsSectionUrl(`${FLASK}/`, ID, "Co", "integration")).toMatch(
      /^http:\/\/flask\.test\/handoff\//,
    );
    expect(paymentRequestSettingsUrl(`${FLASK}/`, ID)).toBe(
      `${FLASK}/entity/${ID}/settings/payment-request?${BACK}`,
    );
    expect(billsUrl(`${FLASK}//`, ID)).toBe(`${FLASK}/entity/${ID}/payment-request?${BACK}`);
  });

  it("reaches the payments app and its settings through Flask, the id encoded", () => {
    expect(billsUrl(FLASK, "a/b")).toBe(`${FLASK}/entity/a%2Fb/payment-request?${BACK}`);
    expect(paymentRequestSettingsUrl(FLASK, "a/b")).toBe(
      `${FLASK}/entity/a%2Fb/settings/payment-request?${BACK}`,
    );
  });

  it("reaches the Petty Cash app's settings through /handoff/petty-cash-web: entity_id, next, return_origin", () => {
    expect(pettyCashSettingsUrl(FLASK, ID, "Olive & Vine")).toBe(
      `${FLASK}/handoff/petty-cash-web?entity_id=${ID}&next=%2Fentity%2F360812e1%2Folive-and-vine%2Fsettings%2Fpetty-cash&${BACK}`,
    );
    expect(new URL(pettyCashSettingsUrl(FLASK, ID, "")).searchParams.get("next")).toBe(
      "/entity/360812e1/company/settings/petty-cash",
    );
  });

  it("names the origin it is given", () => {
    const o = "https://pr-x-my.dailyminty.com";
    for (const url of [
      settingsSectionUrl(FLASK, ID, "Co", "users", o),
      paymentRequestSettingsUrl(FLASK, ID, o),
      pettyCashSettingsUrl(FLASK, ID, "Co", o),
      billsUrl(FLASK, ID, o),
    ]) {
      expect(new URL(url).searchParams.get("return_origin")).toBe(o);
    }
  });
});
