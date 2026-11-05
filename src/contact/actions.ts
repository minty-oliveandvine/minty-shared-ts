/**
 * A page's lines in the cat's pop-up. The launcher is mounted once, in the app's layout, but an
 * action belongs to a page (minty-web's entity list adds "Create company"), and a layout cannot
 * hear from a page below it - so the page registers its lines here while it is mounted, the same
 * module-level store shape as `../lib/viewer.ts`.
 *
 * Snapshots are cached arrays: `useSyncExternalStore` compares by reference.
 */

import { useEffect, useSyncExternalStore } from "react";

/** An extra line in the cat's pop-up: a link (`href`) or a callback (`onSelect`). */
export type ContactAction = {
  id: string;
  label: string;
  icon?: "add" | "chat";
} & ({ href: string; onSelect?: never } | { onSelect: () => void; href?: never });

const registered = new Map<symbol, ContactAction[]>();
let snapshot: ContactAction[] = [];
const listeners = new Set<() => void>();

function publish() {
  snapshot = Array.from(registered.values()).flat();
  for (const listener of listeners) listener();
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

const EMPTY: ContactAction[] = [];

/** Every page's registered lines, in mount order. */
export function useRegisteredContactActions(): ContactAction[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}

/**
 * Put `actions` in the cat's pop-up while the calling component is mounted. Pass a stable array
 * (module-level, or `useMemo`): a new one each render re-registers it each render.
 */
export function useContactActions(actions: ContactAction[]): void {
  useEffect(() => {
    const key = Symbol("contact-actions");
    registered.set(key, actions);
    publish();
    return () => {
      registered.delete(key);
      publish();
    };
  }, [actions]);
}

/** Test seam: forget every registration. */
export function _resetContactActionsForTests(): void {
  registered.clear();
  publish();
}
