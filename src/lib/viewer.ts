/**
 * Who is looking: the name and initials the header's badge and the side menu's profile block
 * show, on every page.
 *
 * The token carries neither (Flask mints only ids and flags), so they are read once per token
 * from Flask's `GET /api/me/profile` and kept here. DECORATION, and treated as such: a read
 * that fails leaves the badge empty and never moves the page (`onUnauthorized: "reject"`) -
 * a lapsed token is the page's own reads' business - but it says so on the console, so a badge
 * that is missing is never a mystery. My Profile calls `primeViewer` after a
 * save, so the header and menu show the new name at once instead of the old one until the
 * next token.
 *
 * Snapshots are CACHED objects, never fresh ones: `useSyncExternalStore` compares by
 * reference, and a new object per read loops forever.
 */

import { useCallback, useSyncExternalStore } from "react";

import { requireSidebarHost, type Viewer } from "../host";

export type { Viewer };

type Loader = () => Promise<Viewer | null>;

// Through the host, because the two apps reach Flask differently (and disagree about what a 401
// means - see their `onUnauthorized` unions). Resolved at call time, never at import time: the
// host is registered by the app, which cannot have happened while this module is still loading.
const readFromHost: Loader = () => requireSidebarHost().loadViewer();

let loader: Loader = readFromHost;
let cache: { token: string; viewer: Viewer | null; loading: boolean } | null = null;
const listeners = new Set<() => void>();

const currentToken = () => requireSidebarHost().currentToken();

function notify() {
  for (const listener of listeners) listener();
}

function ensureLoaded() {
  const token = currentToken();
  if (!token || (cache && cache.token === token)) return;
  const entry = { token, viewer: null as Viewer | null, loading: true };
  cache = entry;
  loader()
    .then((viewer) => {
      if (cache === entry) {
        cache = { token, viewer, loading: false };
        notify();
      }
    })
    .catch((err: unknown) => {
      // Decoration: no badge beats a broken page - but never a silent one. The page carries on
      // without the name; the console says why it is missing.
      console.error("[viewer] the name and initials did not load", err);
      if (cache === entry) cache = { token, viewer: null, loading: false };
    });
}

function snapshot(): Viewer | null {
  const token = currentToken();
  return cache && cache.token === token ? cache.viewer : null;
}

const serverSnapshot = () => null;

/**
 * The person looking, or null until known (or when the read failed). `known` - a viewer the
 * page already has (the module page's own model carries one) - is returned as it stands and
 * no read is made for it.
 */
export function useViewer(known?: Viewer | null): Viewer | null {
  const wanted = !known;
  const subscribe = useCallback(
    (onChange: () => void) => {
      listeners.add(onChange);
      if (wanted) ensureLoaded();
      return () => {
        listeners.delete(onChange);
      };
    },
    [wanted],
  );
  const viewer = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return known ?? viewer;
}

/** After the person changed their own name: every badge and menu shows it at once. */
export function primeViewer(viewer: Viewer) {
  cache = { token: currentToken(), viewer, loading: false };
  notify();
}

/** Test seam: where the viewer comes from (Vitest never reaches Flask), and a clean cache. */
export function _setViewerLoaderForTests(next: Loader | null) {
  loader = next ?? readFromHost;
  cache = null;
}
