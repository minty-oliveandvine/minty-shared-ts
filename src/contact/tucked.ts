/**
 * Whether the viewer has tucked the cat away (v0.15, owner 2026-11-09): a tab on the screen's
 * edge in place of the cat, until it is tapped again. Remembered in `localStorage` - per browser
 * and per app (each app is its own origin), never sent anywhere - and shown on every page of the
 * app until brought back.
 *
 * Tucked is the default (owner, 2026-11-11): a browser that has never brought the cat out - or
 * cannot read storage - shows the tab. Storage says "1" tucked, "0" brought out.
 *
 * An external store, like minty-payment-request-web's Easy view: the setter writes storage and
 * tells every mounted reader, and another tab of the same app follows through the `storage`
 * event. The snapshot is a boolean, so there is nothing to cache.
 */

export const TUCKED_KEY = "minty-cat-tucked";

const listeners = new Set<() => void>();

/** This page's answer, used once storage has refused to read or to save it. */
let unsaved = true;
let storageFailed = false;

export function readTucked(): boolean {
  if (storageFailed) return unsaved;
  try {
    return localStorage.getItem(TUCKED_KEY) !== "0";
  } catch {
    // storage unavailable (private mode, blocked): this page's own answer
    return unsaved;
  }
}

/** The server's (and hydration's) answer: tucked, the default - no cat flashes before the tab. */
export function readTuckedOnServer(): boolean {
  return true;
}

export function subscribeTucked(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === TUCKED_KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function setTucked(next: boolean): void {
  unsaved = next;
  try {
    localStorage.setItem(TUCKED_KEY, next ? "1" : "0");
  } catch (err) {
    // not remembered past this page, but it still tucks now
    storageFailed = true;
    console.error("[contact] the cat's tucked state was not saved", err);
  }
  for (const listener of listeners) listener();
}

/** Tests only: forget this page's unsaved answer. */
export function _resetTuckedForTests(): void {
  unsaved = true;
  storageFailed = false;
}
