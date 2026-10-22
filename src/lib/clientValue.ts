"use client";

/**
 * Reading a browser-only value - a cookie, the token's claims, a `localStorage` entry, "am I in a
 * browser at all" - from a component that also renders on the server (the shared-code refactor,
 * 2026-10-21; it was minty-payment-request-web's `lib/useClientValue.ts`, minty-petty-cash-web's
 * `lib/useAuth.ts`, minty-onboarding-web's `lib/useMounted.ts` and the sidebar's `useMounted`).
 *
 * `useSyncExternalStore` with no subscription: the server and the hydrating render show the
 * server snapshot, and React re-reads the client snapshot itself once mounted, re-rendering only
 * if it differs. It replaces `useState(neutral)` + `useEffect(() => setX(read()), [])`, which React
 * flags (`react-hooks/set-state-in-effect`).
 *
 * Two rules:
 *
 * - Both getters MUST return a referentially stable value while the data is unchanged. A primitive
 *   is fine; an object must be cached (as every app's `getAuthSnapshot()` is). A fresh object on
 *   every call makes React loop.
 * - Nothing subscribes. Cookies and `localStorage` do not notify this tab, so a change underneath
 *   is seen only at the next render. A value that really changes while the page is open needs its
 *   own store with a subscribe that emits.
 */

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

export function useClientValue<T>(getClient: () => T, getServer: () => T): T {
  return useSyncExternalStore(noSubscribe, getClient, getServer);
}

const clientTrue = () => true;
const serverFalse = () => false;

/** "Has this component mounted in a browser?" - false on the server and in hydration, true after. */
export function useMounted(): boolean {
  return useClientValue(clientTrue, serverFalse);
}
