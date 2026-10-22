/**
 * The module token and the cookies that hold it.
 *
 * Minty (Flask) mints an HS256 JWT when a person opens an app and sends the browser to the app's
 * landing, which stores it in three cookies - the token, the company's id and its name - under
 * the app's own prefix (`minty_`, `petty_cash_`, `billing_`), because every app on localhost
 * shares one cookie jar and two apps must never read each other's token. The token cookie is what
 * each app's proxy gates on and what its API client sends as the bearer.
 *
 * Nothing here verifies a signature: the browser cannot hold the key, and every API re-checks
 * the token on every call. Everything is edge-safe (atob, TextDecoder - no Buffer), so a proxy can
 * read a token too.
 *
 * Merged from lib/auth.ts and lib/moduleClaims.ts in minty-web, minty-payment-request-web and
 * minty-petty-cash-web.
 */

import type { ModuleAccess } from "../host";

/** What a cookie lives when the token's `exp` cannot be read - Flask's token lifetime. */
export const FALLBACK_MAX_AGE_SECONDS = 60 * 30;

export type AuthInfo = {
  token: string;
  entityId: string;
  entityName: string;
};

/**
 * The payload of a JWT as a plain object: the middle segment base64url-decoded (unpadded, `-`
 * and `_`), read as UTF-8 and JSON-parsed. Null - never a throw - for anything that is not a
 * three-part token whose payload is a JSON object.
 */
export function decodeJwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** The token's `exp` in seconds, or null when it has none that is a finite number. */
function expiryOf(token: string | null | undefined): number | null {
  const exp = decodeJwtPayload(token)?.exp;
  return typeof exp === "number" && Number.isFinite(exp) ? exp : null;
}

/**
 * Whole seconds until the token's `exp`, floored and at least 1 (a lapsed token's cookie still
 * lives long enough to be judged) - or FALLBACK_MAX_AGE_SECONDS when `exp` cannot be read.
 * `nowMs` is a Date.now() value.
 */
export function secondsUntilExpiry(
  token: string | null | undefined,
  nowMs: number = Date.now(),
): number {
  const exp = expiryOf(token);
  if (exp === null) return FALLBACK_MAX_AGE_SECONDS;
  return Math.max(1, Math.floor(exp - nowMs / 1000));
}

/**
 * Whether the token is past its `exp` by more than `leewaySeconds` of clock skew. No token at all
 * is expired; a token with no readable `exp` is not - it cannot tell, so it does not guess.
 */
export function isTokenExpired(
  token: string | null | undefined,
  leewaySeconds: number = 5,
  nowMs: number = Date.now(),
): boolean {
  if (!token) return true;
  const exp = expiryOf(token);
  if (exp === null) return false;
  return exp - nowMs / 1000 < -leewaySeconds;
}

/**
 * Whether the token lapses within `thresholdSeconds` (already lapsed counts) - when an app with
 * a refresh endpoint should refresh. False with no token or no readable `exp`.
 */
export function isTokenExpiringSoon(
  token: string | null | undefined,
  thresholdSeconds: number = 120,
  nowMs: number = Date.now(),
): boolean {
  const exp = expiryOf(token);
  if (exp === null) return false;
  return exp - nowMs / 1000 < thresholdSeconds;
}

/**
 * Which modules the company in the token has. Flask mints `petty_cash_enabled` /
 * `billing_enabled`; only a literal `false` turns a module off - no token, a malformed one, a
 * missing or non-boolean claim all mean on, because an old token must never hide navigation.
 */
export function moduleClaims(
  tokenOrPayload: string | Record<string, unknown> | null | undefined,
): ModuleAccess {
  const claims =
    (typeof tokenOrPayload === "string" ? decodeJwtPayload(tokenOrPayload) : tokenOrPayload) ?? {};
  return {
    pettyCash: claims.petty_cash_enabled !== false,
    billing: claims.billing_enabled !== false,
  };
}

export type CookieAuthOptions = {
  /** The app's cookie prefix: `minty` gives `minty_token`, `minty_entity_id`, `minty_entity_name`. */
  prefix: string;
  /**
   * A fixed cookie lifetime in seconds (payment-request's 8 hours, which its refresh renews).
   * Omitted: the cookies live exactly as long as the token (secondsUntilExpiry).
   */
  maxAge?: number;
};

export type CookieAuth = {
  setAuth(info: AuthInfo): void;
  /** The three cookies, or null when the token cookie is missing or empty. A fresh object each call. */
  getAuth(): AuthInfo | null;
  clearAuth(): void;
  /**
   * `getAuth()`, but the SAME object while the cookies are unchanged - a `useSyncExternalStore`
   * snapshot is compared by identity, and a fresh object per call loops forever.
   */
  getAuthSnapshot(): AuthInfo | null;
  /** The names a proxy reads on the server. */
  cookieNames: { readonly token: string; readonly entityId: string; readonly entityName: string };
};

function readJar(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const jar: Record<string, string> = {};
  for (const pair of document.cookie.split("; ")) {
    if (!pair) continue;
    // Split on the FIRST "=": a padded value ends in one.
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const raw = pair.slice(idx + 1);
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      // A cookie this app did not encode: keep it as it stands rather than lose the whole jar.
    }
    jar[pair.slice(0, idx)] = value;
  }
  return jar;
}

export function createCookieAuth({ prefix, maxAge }: CookieAuthOptions): CookieAuth {
  if (!prefix) throw new Error("createCookieAuth needs a cookie prefix.");
  if (maxAge !== undefined && !(Number.isInteger(maxAge) && maxAge > 0)) {
    throw new Error(`createCookieAuth: maxAge must be a positive whole number of seconds.`);
  }

  const cookieNames = {
    token: `${prefix}_token`,
    entityId: `${prefix}_entity_id`,
    entityName: `${prefix}_entity_name`,
  } as const;

  function options(token: string): string {
    const age = maxAge ?? secondsUntilExpiry(token);
    const secure = typeof window !== "undefined" && window.location?.protocol === "https:";
    return `path=/;max-age=${age};SameSite=Lax${secure ? ";Secure" : ""}`;
  }

  function setAuth({ token, entityId, entityName }: AuthInfo): void {
    const opts = options(token);
    document.cookie = `${cookieNames.token}=${encodeURIComponent(token)};${opts}`;
    document.cookie = `${cookieNames.entityId}=${encodeURIComponent(entityId)};${opts}`;
    document.cookie = `${cookieNames.entityName}=${encodeURIComponent(entityName)};${opts}`;
  }

  function getAuth(): AuthInfo | null {
    const jar = readJar();
    const token = jar[cookieNames.token];
    if (!token) return null;
    return {
      token,
      entityId: jar[cookieNames.entityId] ?? "",
      entityName: jar[cookieNames.entityName] ?? "",
    };
  }

  function clearAuth(): void {
    const expire = "path=/;max-age=0";
    document.cookie = `${cookieNames.token}=;${expire}`;
    document.cookie = `${cookieNames.entityId}=;${expire}`;
    document.cookie = `${cookieNames.entityName}=;${expire}`;
  }

  let jarAtParse: string | null = null;
  let parsed: AuthInfo | null = null;

  function getAuthSnapshot(): AuthInfo | null {
    if (typeof document === "undefined") return null;
    if (document.cookie !== jarAtParse) {
      jarAtParse = document.cookie;
      parsed = getAuth();
    }
    return parsed;
  }

  return { setAuth, getAuth, clearAuth, getAuthSnapshot, cookieNames };
}
