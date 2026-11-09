/**
 * Where the viewer has dragged the cat (v0.15, owner 2026-11-09: "just allow minty to be moved
 * anywhere"): its distance from the screen's right and bottom edges, in px, exactly where it was
 * let go - no snapping. `null` is its resting spot at the bottom right. Kept on screen when the
 * window shrinks (the launcher clamps it).
 *
 * Remembered in `localStorage` like `./tucked.ts` - per browser and per app, never sent anywhere -
 * and read by an external store. The snapshot is cached by its stored text, because
 * `useSyncExternalStore` compares by reference.
 */

export type Place = { right: number; bottom: number };

export const PLACE_KEY = "minty-cat-place";

const listeners = new Set<() => void>();

let unsaved: Place | null = null;
let storageFailed = false;
let cachedRaw: string | null = null;
let cached: Place | null = null;

const distance = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;

function parse(raw: string | null): Place | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Place>;
    const right = distance(value.right);
    const bottom = distance(value.bottom);
    return right === null || bottom === null ? null : { right, bottom };
  } catch {
    return null;
  }
}

export function readPlace(): Place | null {
  if (storageFailed) return unsaved;
  let raw: string | null;
  try {
    raw = localStorage.getItem(PLACE_KEY);
  } catch {
    return unsaved;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

/** The server's (and hydration's) answer: the resting spot. */
export function readPlaceOnServer(): Place | null {
  return null;
}

export function subscribePlace(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === PLACE_KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function setPlace(next: Place | null): void {
  unsaved = next;
  try {
    if (next) localStorage.setItem(PLACE_KEY, JSON.stringify(next));
    else localStorage.removeItem(PLACE_KEY);
  } catch (err) {
    // not remembered past this page, but it still moves now
    storageFailed = true;
    console.error("[contact] the cat's place was not saved", err);
  }
  for (const listener of listeners) listener();
}

/** Tests only. */
export function _resetPlaceForTests(): void {
  unsaved = null;
  storageFailed = false;
  cachedRaw = null;
  cached = null;
}
