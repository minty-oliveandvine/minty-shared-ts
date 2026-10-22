/**
 * Getting a token, and getting a new one - one implementation for every app (the shared-code
 * refactor, 2026-10-21; it was minty-web's and minty-petty-cash-web's `lib/handoff.ts`, the
 * petty-cash `lib/hub.ts` hubUrl, minty-payment-request-web's `lib/mintyUrls.ts` and sidebar
 * `handoff()`, minty-web's `lib/mintyEntry.ts` and `lib/logout.ts`, and each `app/landing`).
 *
 * No app mints or refreshes a token: Flask is the single minter. Both the first arrival and a
 * lapsed session go through a login-gated Flask hand-off, `GET <flask><route>?next=<path>&
 * entity_id=<company>` (Minty `blueprints/entity/routes/modules.py`): with a live Flask session it
 * mints the app's token and sends the browser straight back to `/landing?token=…&next=<path>` - a
 * silent round trip, because Flask's session outlives the 30-minute token; without one it shows
 * the sign-in first and then does the same.
 *
 * Every trip to Flask names the page's origin as `return_origin` (previewSibling.ts), so Flask can
 * hand back into a branch preview set; Flask ignores it everywhere else.
 *
 * Nothing here reads a cookie or an env value: the app passes its Flask base, its route and its
 * own `clearAuth`, so the package never reaches into an app (or its auth module). No React here
 * either - a server component or the proxy may import it; the landing's hook is `./landing.ts`.
 */

import { withReturnOrigin } from "./previewSibling";
import { safeNextPath } from "./safeNext";

/** A base URL with every trailing slash taken off, so `${base}/path` never doubles one. */
function trimBase(base: string): string {
  return base.replace(/\/+$/, "");
}

/**
 * `<flask><route>?next=<next>&entity_id=<company>&return_origin=<origin>` - the one spelling of a
 * Flask hand-off. `next` is written as given (the caller decides what is safe); an empty or absent
 * company names none. `origin` defaults to the page's own (pass the request's on the server).
 */
export function flaskHandoffUrl(
  flaskBase: string,
  route: string,
  next: string,
  entityId?: string | null,
  origin?: string,
): string {
  const qs = new URLSearchParams({ next });
  if (entityId) qs.set("entity_id", entityId);
  return withReturnOrigin(`${trimBase(flaskBase)}${route}?${qs.toString()}`, origin);
}

/** Flask's hand-off into minty-web (the hub): `/handoff/minty-web`. */
export const HUB_HANDOFF_ROUTE = "/handoff/minty-web";

/**
 * A page of minty-web (`next`, a path on the hub) through Flask's login-gated
 * `/handoff/minty-web`, scoped to `entityId` when given. Flask's route takes a full company id
 * only - never the address form `<shortid>/<name>`.
 */
export function hubHandoffUrl(
  flaskBase: string,
  next: string,
  entityId?: string | null,
  origin?: string,
): string {
  return flaskHandoffUrl(flaskBase, HUB_HANDOFF_ROUTE, next, entityId, origin);
}

/** Flask's `/logout`: ends the session everywhere, then lands on minty-web's sign-in. No way back. */
export function logoutUrl(flaskBase: string): string {
  return `${trimBase(flaskBase)}/logout`;
}

/**
 * Into Minty for one company with the token the app holds: Flask's `/entity/<id>/enter`
 * (`entity.module_reenter`) validates the token, re-establishes the Flask session and forwards to
 * `next` - so the person lands signed in rather than on a sign-in screen. Query order: token,
 * next, return_origin. An empty `next` is none.
 *
 * Null when there is nothing to enter with (no company or no token): the app picks its own
 * fallback (minty-web its entity list, the payments app Flask's `/entity`).
 */
export function mintyEntryUrl({
  mintyBase,
  entityId,
  token,
  next,
  origin,
}: {
  mintyBase: string;
  entityId: string | null | undefined;
  token: string | null | undefined;
  next?: string | null;
  origin?: string;
}): string | null {
  if (!entityId || !token) return null;
  const base = `${trimBase(mintyBase)}/entity/${encodeURIComponent(entityId)}/enter?token=${encodeURIComponent(token)}`;
  return withReturnOrigin(next ? `${base}&next=${encodeURIComponent(next)}` : base, origin);
}

type Navigate = (url: string) => void;

const assignLocation: Navigate = (url) => {
  window.location.href = url;
};

export type HandoffOptions = {
  /** Flask's base URL (the accounts API), read on every call. */
  flaskBase: () => string;
  /** This app's hand-off route on Flask, e.g. `/handoff/minty-web`, `/handoff/petty-cash-web`. */
  route: string;
  /** Forget the app's token - run before the browser leaves, never after. */
  clearAuth: () => void;
  /**
   * The company to name when `redirectToHandoff` is given none (undefined) - read BEFORE
   * `clearAuth`, so it can be the cookie's. Petty Cash: the cookie's company.
   */
  companyFallback?: () => string | null;
  /**
   * The company a `next` names, for `handoffUrl` when given none (an empty id counts as none) -
   * Petty Cash's `addressCompanyRef` (companyRef.ts), as its cookie lapses with its token and the
   * address is then all it knows. Only for a route that accepts `<shortid>/<name>`
   * (`/handoff/petty-cash-web` does, `/handoff/minty-web` does not).
   */
  companyFromNext?: (next: string) => string | null;
  /** Where a hand-off with no safe `next` lands. Default `/`. */
  home?: string;
};

export type Handoff = {
  /** A `next` this app may land on: a path on its own origin, else `fallback` (default `home`). */
  safeNext(raw: string | null | undefined, fallback?: string): string;
  /** Flask's hand-off back into this app for `next` (made safe), naming the company. */
  handoffUrl(next?: string | null, entityId?: string, origin?: string): string;
  /**
   * Send the browser to Flask for a fresh token, once: several requests in flight fail together
   * on an expired token, and each one reassigning `location.href` while the first navigation is
   * under way is how a redirect turns into a flicker. Clears the token first. With no `next`, the
   * page it is on.
   */
  redirectToHandoff(next?: string, entityId?: string): void;
  /** Leave for another address through the same seam - every time, the URL untouched. */
  leaveTo(url: string): void;
  /**
   * Test seam: forget that a redirect is under way, and optionally capture the navigation instead
   * of assigning `location.href` (jsdom does not allow `location` to be replaced).
   */
  _resetForTests(capture?: Navigate): void;
};

export function createHandoff(options: HandoffOptions): Handoff {
  const home = options.home ?? "/";
  let navigate: Navigate = assignLocation;
  let redirecting = false;

  const safeNext = (raw: string | null | undefined, fallback: string = home) =>
    safeNextPath(raw, fallback);

  const handoffUrl = (next?: string | null, entityId?: string, origin?: string) => {
    const safe = safeNext(next);
    const entity = entityId || options.companyFromNext?.(safe) || null;
    return flaskHandoffUrl(options.flaskBase(), options.route, safe, entity, origin);
  };

  return {
    safeNext,
    handoffUrl,
    redirectToHandoff(next, entityId) {
      if (redirecting || typeof window === "undefined") return;
      redirecting = true;
      const entity = entityId ?? (options.companyFallback?.() || undefined);
      options.clearAuth();
      const target = next ?? window.location.pathname + window.location.search;
      navigate(handoffUrl(target, entity));
    },
    leaveTo(url) {
      navigate(url);
    },
    _resetForTests(capture) {
      redirecting = false;
      navigate = capture ?? assignLocation;
    },
  };
}
