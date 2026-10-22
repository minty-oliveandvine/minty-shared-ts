/**
 * A company in an address: `<shortid>/<name>` (2026-10-05) - the first 8 characters of its id,
 * then its name as a readable segment. The short id decides; the name is only for reading, so
 * a renamed company's old links still find it.
 *
 * The same rule as Flask's `blueprints/shared/entity_ref.py::slugify_name` - keep them alike, so
 * a link Flask builds is the one this app would build (a mismatch only costs a replace).
 */

import { hubHandoffUrl } from "./handoff";
import { withReturnOrigin } from "./previewSibling";

export const SHORT_ID_LENGTH = 8;
const SLUG_MAX = 60;
const EMPTY_SLUG = "company";

/** Lowercase, `&` as "and", letters and digits of any script kept, anything else one `-`. */
export function slugifyName(name: string | null | undefined): string {
  const text = (name ?? "").normalize("NFKC").toLowerCase().replace(/&/g, " and ");
  const slug = Array.from(text, (ch) => (/[\p{L}\p{N}]/u.test(ch) ? ch : "-"))
    .join("")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, SLUG_MAX).replace(/-+$/, "") || EMPTY_SLUG;
}

export function shortIdOf(entityId: string): string {
  return entityId.slice(0, SHORT_ID_LENGTH).toLowerCase();
}

/** `<shortid>/<slug>`, each part ready for a path. */
export function companyRef(entityId: string, name: string | null | undefined): string {
  return `${encodeURIComponent(shortIdOf(entityId))}/${encodeURIComponent(slugifyName(name))}`;
}

/** Where every company's pages start: `/entity` - singular, one company (the list is `/entities`). */
export const COMPANY_BASE = "/entity";

/**
 * A company's page: `/entity/<shortid>/<slug>/<segments…>` - the address form every app shares.
 * Each segment is written as given (encode a value that needs it), with its own leading and
 * trailing slashes dropped and empty ones skipped, so `"settings", "users"` and
 * `"/settings/users"` are the same page.
 */
export function companyPath(
  entityId: string,
  name: string | null | undefined,
  ...segments: string[]
): string {
  const rest = segments.map((s) => s.replace(/^\/+|\/+$/g, "")).filter(Boolean);
  return [`${COMPANY_BASE}/${companyRef(entityId, name)}`, ...rest].join("/");
}

/** `/entity/<8 hex>/<slug>` at the START of a path, then `/`, `?`, `#` or the end. */
const COMPANY_PATH = /^\/entity\/([0-9a-fA-F]{8})\/([^/?#]+)(?:[/?#]|$)/;

/**
 * The company a path names - its short id (lowercased) and its slug, decoded (a path is
 * percent-encoded; a malformed escape is kept as written, since only the short id decides) - or
 * null when the path is not inside a company. Exactly eight hex characters, at the start.
 */
export function companyRefFromPath(pathname: string): { shortId: string; slug: string } | null {
  const m = COMPANY_PATH.exec(pathname);
  if (!m) return null;
  let slug = m[2];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    // a malformed escape: keep it as written
  }
  return { shortId: m[1].toLowerCase(), slug };
}

/**
 * The company a path names as Flask's address form `<shortid>/<name>` (Minty
 * `blueprints/shared/entity_ref.py` resolves it), or null. For `/handoff/petty-cash-web`'s
 * `entity_id` - the hand-off's `companyFromNext` - never for `/handoff/minty-web`, which takes a
 * full id only.
 */
export function addressCompanyRef(pathname: string): string | null {
  const ref = companyRefFromPath(pathname);
  return ref ? `${ref.shortId}/${ref.slug}` : null;
}

// --- the settings pills' cross-app addresses -----------------------------------------------------
//
// Every app's settings pills lead to the same five places. Each app holds only its own settings
// page, so a pill of another app goes through Flask, which mints that app's token on the way - no
// token in the address, the Flask session is the credential. `base` is Flask's (the accounts API);
// a trailing slash on it is dropped. `origin` (the `return_origin` Flask may hand a preview set
// back to) defaults to the page's own.

/** minty-web's settings sections: Users, Entity & Integration (where Xero is connected), Modules. */
export type HubSettingsSection = "users" | "integration" | "modules";

function flaskBase(base: string): string {
  return base.replace(/\/+$/, "");
}

/**
 * One of minty-web's settings sections for the company (`/entity/<shortid>/<slug>/settings/
 * <section>` on the hub), through Flask's `/handoff/minty-web`, scoped to the company.
 */
export function settingsSectionUrl(
  base: string,
  entityId: string,
  name: string | null | undefined,
  section: HubSettingsSection,
  origin?: string,
): string {
  return hubHandoffUrl(base, companyPath(entityId, name, "settings", section), entityId, origin);
}

/**
 * The payments app's settings for the company, through Flask's `/entity/<id>/settings/
 * payment-request` (Minty `entity_settings_payments`): it mints that app's token and redirects.
 */
export function paymentRequestSettingsUrl(base: string, entityId: string, origin?: string): string {
  return withReturnOrigin(
    `${flaskBase(base)}/entity/${encodeURIComponent(entityId)}/settings/payment-request`,
    origin,
  );
}

/**
 * The Petty Cash app's settings for the company (`/entity/<shortid>/<slug>/settings/petty-cash`
 * there), through Flask's `/handoff/petty-cash-web`, which mints that app's token for THIS
 * company. Query order: entity_id, next, return_origin.
 */
export function pettyCashSettingsUrl(
  base: string,
  entityId: string,
  name: string | null | undefined,
  origin?: string,
): string {
  const qs = new URLSearchParams({
    entity_id: entityId,
    next: companyPath(entityId, name, "settings", "petty-cash"),
  });
  return withReturnOrigin(`${flaskBase(base)}/handoff/petty-cash-web?${qs.toString()}`, origin);
}

/** The payments app for the company, through Flask's token hand-off (`/entity/<id>/payment-request`). */
export function billsUrl(base: string, entityId: string, origin?: string): string {
  return withReturnOrigin(
    `${flaskBase(base)}/entity/${encodeURIComponent(entityId)}/payment-request`,
    origin,
  );
}
