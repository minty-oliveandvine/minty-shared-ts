// src/lib/companyRef.ts's address rule in plain JS, for the Playwright suites (config/e2e.mjs):
// Playwright will not load .ts from node_modules. src/__tests__/configPresets.test.ts proves the two
// give the same answers - change them together.

const SHORT_ID_LENGTH = 8;
const SLUG_MAX = 60;
const EMPTY_SLUG = "company";

/** Lowercase, `&` as "and", letters and digits of any script kept, anything else one `-`. */
export function slugifyName(name) {
  const text = (name ?? "").normalize("NFKC").toLowerCase().replace(/&/g, " and ");
  const slug = Array.from(text, (ch) => (/[\p{L}\p{N}]/u.test(ch) ? ch : "-"))
    .join("")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, SLUG_MAX).replace(/-+$/, "") || EMPTY_SLUG;
}

export function shortIdOf(entityId) {
  return entityId.slice(0, SHORT_ID_LENGTH).toLowerCase();
}

/** `<shortid>/<slug>`, each part ready for a path. */
export function companyRef(entityId, name) {
  return `${encodeURIComponent(shortIdOf(entityId))}/${encodeURIComponent(slugifyName(name))}`;
}
