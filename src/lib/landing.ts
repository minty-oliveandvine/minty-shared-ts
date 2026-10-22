"use client";

/**
 * The `/landing` page's logic, the same in minty-web, minty-petty-cash-web and
 * minty-payment-request-web (the shared-code refactor, 2026-10-21; each had its own
 * `app/landing/page.tsx`). Its own module, apart from `./handoff.ts`, because it is a hook: a
 * server component or the proxy importing the hand-off URLs must not pull React's client hooks in.
 */

import { useEffect } from "react";

import { safeNextPath } from "./safeNext";

/** What the landing reads off its address: `token`, `entity_id`, `entity_name` and a safe `next`. */
export type LandingParams = { token: string; entityId: string; entityName: string; next: string };

/** The landing's address, read: absent values are "", an unsafe or absent `next` is `home`. */
export function readLanding(
  searchParams: { get(name: string): string | null },
  home: string,
): LandingParams {
  return {
    token: searchParams.get("token") ?? "",
    entityId: searchParams.get("entity_id") ?? "",
    entityName: searchParams.get("entity_name") ?? "",
    next: safeNextPath(searchParams.get("next"), home),
  };
}

export type LandingOptions = {
  /** The app's `useSearchParams()` - passed in, so a test's mock of next/navigation reaches it. */
  searchParams: { get(name: string): string | null };
  /** The app's `useRouter()`. */
  router: { replace(href: string): void };
  /** Store the token and its company (empty strings when the hand-off named none). */
  setAuth: (token: string, entityId: string, entityName: string) => void;
  /** Where a landing with no safe `next` goes. */
  home: string;
  /** Reached with no token (a bookmark, a stale tab; an empty token is none): the app's way back. */
  onNoToken: (landing: LandingParams) => void;
};

/**
 * The `/landing` page's logic, the same in every app: Flask's hand-off arrives as
 * `/landing?token=<jwt>&next=<path>&entity_id=…&entity_name=…`. With a token, store it and
 * `router.replace` the safe `next`; without one, the app's `onNoToken` (minty-web and Petty Cash
 * go back through their re-handoff, the payments app to Flask's `/entity`). Pass module-level
 * functions: the effect runs again when one changes.
 */
export function useLandingHandoff({
  searchParams,
  router,
  setAuth,
  home,
  onNoToken,
}: LandingOptions): void {
  useEffect(() => {
    const landing = readLanding(searchParams, home);
    if (!landing.token) {
      onNoToken(landing);
      return;
    }
    setAuth(landing.token, landing.entityId, landing.entityName);
    router.replace(landing.next);
  }, [searchParams, router, setAuth, home, onNoToken]);
}
