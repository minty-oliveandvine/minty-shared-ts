"use client";

/**
 * "Back" to the page the person came from - every app's back controls (v0.20; moved from
 * minty-web's `lib/backLink.ts` + `components/ui/BackLink.tsx`, which it had since 2026-10-05).
 *
 * "Came from" = the last entry in this tab's history on THIS origin that is not skipped:
 * - `skip`: pathnames the caller steps over (minty-web: a company's settings tabs, so moving
 *   between tabs and reloads never count; Petty Cash: the report wizard's steps, so Back from any
 *   step returns to where the wizard was entered);
 * - always: the hand-off pages (`/landing`, `/handoff/...`, `/enter`) - their codes are one-time,
 *   so going back into one is refused.
 *
 * When this origin's run of entries holds no such page:
 * - `leaveApp: true` (minty-web) - step back into the page before the run, another app's, when
 *   the tab holds one; else the fallback.
 * - `leaveApp: false` (the default) - the fallback: the other app's page was reached through a
 *   hand-off, never to be replayed.
 *
 * Without the Navigation API the history cannot be read: `leaveApp` callers `history.back()`
 * when there is history (minty-web's rule before v0.20), the others follow the fallback.
 */

import type { MouseEvent, ReactNode } from "react";

/** The hand-off pages every app has: never a place to go back to. */
const HANDOFF_PAGES = [/^\/landing(\/|$)/, /^\/handoff(\/|$)/, /^\/enter(\/|$)/];

export type BackOptions = { skip?: RegExp[]; leaveApp?: boolean };

type NavEntry = { index: number; url: string | null };
type NavigationLike = { currentEntry: NavEntry | null; entries(): NavEntry[] };

/** Whether `href` is a page on `origin` that Back steps over. */
export function isSkipped(href: string | null, origin: string, skip: RegExp[] = []): boolean {
  if (!href) return false;
  try {
    const url = new URL(href, origin);
    if (url.origin !== origin) return false;
    return [...HANDOFF_PAGES, ...skip].some((rule) => rule.test(url.pathname));
  } catch {
    return false;
  }
}

/**
 * How many entries to go back (0 = nothing to go back to: the fallback), or null when the
 * browser cannot say (no Navigation API).
 *
 * `navigation.entries()` lists only THIS origin's run of entries, and an entry's `index` is its
 * place in that list - not in the tab's whole history. So when every entry before this one is
 * skipped, `historyLength` tells whether another app's page came before the run: the tab holds
 * more entries than the run (a new navigation clears the forward ones).
 */
export function stepsBack(
  nav: NavigationLike | undefined,
  origin: string,
  historyLength: number,
  { skip = [], leaveApp = false }: BackOptions = {},
): number | null {
  if (!nav?.currentEntry || typeof nav.entries !== "function") return null;
  const entries = nav.entries();
  const at = nav.currentEntry.index;
  if (at < 0 || at >= entries.length) return null;
  for (let p = at - 1; p >= 0; p -= 1) {
    if (!isSkipped(entries[p].url, origin, skip)) return at - p;
  }
  return leaveApp && historyLength > entries.length ? at + 1 : 0;
}

/** Go back as above, or to `fallback` when there is nothing to go back to. */
export function goBack(fallback: string, options: BackOptions = {}): void {
  const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
  const steps = stepsBack(nav, window.location.origin, window.history.length, options);
  if (steps === null) {
    if (options.leaveApp && window.history.length > 1) window.history.back();
    else window.location.assign(fallback);
    return;
  }
  if (steps > 0) window.history.go(-steps);
  else window.location.assign(fallback);
}

/**
 * A real link to `href` - the fallback, what a new tab, a middle-click or no script opens -
 * whose plain click goes back to the page the person came from (`goBack`). Marked
 * `data-back-link` for tests.
 */
export function BackLink({
  href,
  className,
  ariaLabel,
  skip,
  leaveApp,
  children,
}: {
  href: string;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
} & BackOptions) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    goBack(href, { skip, leaveApp });
  };
  return (
    <a href={href} className={className} aria-label={ariaLabel} onClick={onClick} data-back-link>
      {children}
    </a>
  );
}
