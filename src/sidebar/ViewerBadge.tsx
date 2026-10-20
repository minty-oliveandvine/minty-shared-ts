"use client";

/**
 * The person's initials in the header - their name on hover, and My Profile on a click: the
 * sidebar opens over the page on the profile (the user's call, 2026-09-29, reversing the
 * morning's hover-only badge). The menu's name opens the same view.
 *
 * Without a sidebar that can hold the profile (a screen on its own), the badge is a link to the
 * `/profile` page instead - the same place, the long way round.
 *
 * `viewer` is what the page already knows (the module page's own model names the viewer);
 * without one the badge reads it once per token from Flask (`lib/viewer.ts`). Drawn only once
 * known - an empty circle would be a guess.
 */

import { useRef } from "react";

import { requireSidebarHost, type Viewer } from "../host";
import { useViewer } from "../lib/viewer";
import { SIDEBAR_LOOK } from "./looks";
import { useLook, useSidebar } from "./Sidebar";

// The badge's classes are the look's (`./looks.ts`): v2 draws a 28px circle inside a 44px hit area
// (Part 13 §13.16, `-m-2` so it takes no extra room); classic is the 28px circle itself.

export function ViewerBadge({ viewer }: { viewer?: Viewer | null }) {
  const host = requireSidebarHost();
  const person = useViewer(viewer);
  const sidebar = useSidebar();
  const L = SIDEBAR_LOOK[useLook()];
  const badge = useRef<HTMLButtonElement>(null);
  if (!person) return null;

  const label = `${person.name}, My Profile`;
  if (sidebar?.canOpenProfile) {
    return (
      <button
        ref={badge}
        type="button"
        onClick={() => sidebar.openProfile(badge.current)}
        className={L.badge}
        aria-label={label}
        aria-expanded={sidebar.open && sidebar.view === "profile"}
        aria-controls={sidebar.panelId}
        title={person.name}
      >
        <span className={L.badgeCircle} aria-hidden>
          {person.initials}
        </span>
      </button>
    );
  }
  return (
    <a href={host.links.profile()} className={L.badge} aria-label={label} title={person.name}>
      <span className={L.badgeCircle} aria-hidden>
        {person.initials}
      </span>
    </a>
  );
}
