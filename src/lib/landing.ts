"use client";

/**
 * The `/landing` page's logic, the same in minty-web, minty-petty-cash-web and
 * minty-payment-request-web (the shared-code refactor, 2026-10-21; each had its own
 * `app/landing/page.tsx`). Its own module, apart from `./handoff.ts`, because it is a hook: a
 * server component or the proxy importing the hand-off URLs must not pull React's client hooks in.
 */

import { useEffect, useState } from "react";

import { _resetHandoffCodesForTests, HANDOFF_CODE_REFUSED, redeemHandoffCodeOnce } from "./handoff";
import { safeNextPath } from "./safeNext";

/**
 * What the landing reads off its address: the one-time `code` (gap 4), `entity_id`, `entity_name`
 * and a safe `next`. A `token` in the address is never read (v0.17).
 */
export type LandingParams = {
  code: string;
  entityId: string;
  entityName: string;
  next: string;
};

/** The landing's address, read: absent values are "", an unsafe or absent `next` is `home`. */
export function readLanding(
  searchParams: { get(name: string): string | null },
  home: string,
): LandingParams {
  return {
    code: searchParams.get("code") ?? "",
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
  /**
   * Reached with no code (a bookmark, a stale tab, an old `?token=` link; empty is none): the app's
   * way back. Also what the page's "Continue" runs after a refused code.
   */
  onNoToken: (landing: LandingParams) => void;
  /** accounts-api's base URL, where the code is swapped (`redeemHandoffCode`). */
  accountsApiUrl: () => string;
};

/** Where the landing is: still on its way, or a code that could not be swapped (`refused`). */
export type LandingState = { refused: string | null };

/** Test seam: forget the swaps made so far. */
export function _resetLandingForTests(): void {
  _resetHandoffCodesForTests();
}

/**
 * The `/landing` page's logic, the same in every app: accounts-api's hand-off arrives as
 * `/landing?code=<one-time code>&next=<path>&entity_id=…&entity_name=…` (gap 4). The code is
 * swapped for the token (`redeemHandoffCode`), which is stored before `router.replace` goes to the
 * safe `next`; a code that cannot be swapped leaves `refused` set to the sentence to show, and the
 * page offers its "Continue" (`onNoToken`) - never an automatic redirect, which could loop. With
 * no code, the app's `onNoToken` straight away (minty-web and Petty Cash go back through their
 * re-handoff, the payments app to accounts-api's `/entity`); a `?token=` in the address is never
 * stored (v0.17 - an address is not a way to hand anyone a session). Pass module-level functions:
 * the effect runs again when one changes.
 */
export function useLandingHandoff({
  searchParams,
  router,
  setAuth,
  home,
  onNoToken,
  accountsApiUrl,
}: LandingOptions): LandingState {
  const [refused, setRefused] = useState<string | null>(null);
  useEffect(() => {
    const landing = readLanding(searchParams, home);
    if (landing.code) {
      let live = true;
      redeemHandoffCodeOnce(accountsApiUrl(), landing.code).then(
        (token) => {
          if (!live) return;
          setAuth(token, landing.entityId, landing.entityName);
          router.replace(landing.next);
        },
        (err: unknown) => {
          if (!live) return;
          setRefused(err instanceof Error && err.message ? err.message : HANDOFF_CODE_REFUSED);
        },
      );
      return () => {
        live = false;
      };
    }
    onNoToken(landing);
  }, [searchParams, router, setAuth, home, onNoToken, accountsApiUrl]);
  return { refused };
}
