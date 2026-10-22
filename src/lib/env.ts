/**
 * A sibling service's base URL from the environment - one rule in every app (the shared-code
 * refactor, 2026-10-21).
 *
 * The value is trimmed and every trailing slash stripped, so callers can always write
 * `${base}/path`. A missing or blank value (a lone "/" counts as blank) gets `devFallback` - the
 * owner's local port - in development and tests only. In a production build it THROWS, naming the
 * variable: a deployed app has no default, and a silent localhost would only show up as broken
 * sign-ins (CLAUDE.md: fail loudly, no silent defaults for required config).
 *
 * Pass the raw value as a literal `process.env.X` in the app (next.config.ts lists it under
 * `env`), so Next inlines it into the client bundle and the proxy; a dynamic `process.env[name]`
 * here would never be inlined and reads undefined in the browser.
 *
 * Merged from `url()` in each app's lib/env.ts and minty-onboarding-web's lib/flaskBase.ts and
 * lib/apiRoutes.ts `strip`.
 */

function cleanUrl(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\/+$/, "");
}

/**
 * `raw` (the variable `name`'s value) as a base URL: trimmed, no trailing slash. Blank ->
 * `devFallback` outside production, an Error naming `name` in production. Not otherwise
 * validated: anything else stands as written.
 */
export function envUrl(name: string, raw: string | null | undefined, devFallback: string): string {
  const value = cleanUrl(raw);
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} is not set. A production build needs it; there is no default.`);
  }
  return cleanUrl(devFallback);
}
