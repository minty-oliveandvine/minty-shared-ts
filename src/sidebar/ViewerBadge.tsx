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
import { useSidebar } from "./Sidebar";

// Part 14 App bar avatar: a 32px circle in the avatar accent, inside a 44px target (Part 13 §13.16).
const BADGE =
  "group inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";
const CIRCLE =
  "flex size-8 items-center justify-center rounded-full bg-accent-avatar-bg text-label text-accent-avatar-ink transition-shadow duration-100 group-hover:ring-2 group-hover:ring-border-selected/40";

export function ViewerBadge({ viewer }: { viewer?: Viewer | null }) {
  const host = requireSidebarHost();
  const person = useViewer(viewer);
  const sidebar = useSidebar();
  const badge = useRef<HTMLButtonElement>(null);
  if (!person) return null;

  const label = `${person.name}, My Profile`;
  if (sidebar?.canOpenProfile) {
    return (
      <button
        ref={badge}
        type="button"
        onClick={() => sidebar.openProfile(badge.current)}
        className={BADGE}
        aria-label={label}
        aria-expanded={sidebar.open && sidebar.view === "profile"}
        aria-controls={sidebar.panelId}
        title={person.name}
      >
        <span className={CIRCLE} aria-hidden>
          {person.initials}
        </span>
      </button>
    );
  }
  return (
    <a href={host.links.profile()} className={BADGE} aria-label={label} title={person.name}>
      <span className={CIRCLE} aria-hidden>
        {person.initials}
      </span>
    </a>
  );
}
