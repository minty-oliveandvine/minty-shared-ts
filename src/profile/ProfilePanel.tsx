"use client";

/**
 * My Profile in the sidebar - the view the header's initials open, and the menu's name switches
 * to (the user's call, 2026-09-29: one sidebar, two views - `../sidebar/Sidebar.tsx`). Over the
 * page, never a page of its own (the owner, 2026-10-20). ‹ goes back to the menu, × closes - on a
 * phone the panel fills the screen, so there is nothing beside it to click.
 *
 * The sidebar mounts it only once the view is asked for, so nothing is read before then. The app
 * hands in its two Flask calls (`api`), its toast (`notify`) and, if it has one, its subscription
 * overview card (`subscriptions`):
 *
 *   <SidebarProvider profile={<ProfilePanel api={profileApi} notify={toast} />}>
 *
 * `api` should be a stable object (module-level): a new one per render reads the profile again.
 */

import type { ReactNode } from "react";

import type { Look } from "../sidebar/looks";

import { useSidebar } from "../sidebar/Sidebar";
import { ProfileBody } from "./ProfileBody";
import { ProfilePanelTitlebar } from "./ProfileParts";
import type { ProfileApi, ProfileNotify } from "./types";
import { useProfile } from "./useProfile";
import { useProfileLook } from "./useProfileLook";

export function ProfilePanel({
  api,
  notify,
  subscriptions,
  look,
}: {
  api: ProfileApi;
  notify: ProfileNotify;
  subscriptions?: ReactNode;
  /** The design; omitted, the sidebar provider's `look`. */
  look?: Look;
}) {
  const p = useProfile(api, notify);
  const sidebar = useSidebar();
  const L = useProfileLook(look);

  return (
    // flex-1, not just min-h-full: the sheet's <section> has only a min-height, so a percentage
    // min-height resolves to auto and the panel stopped at its content, the sheet showing below.
    <div className={L.panel}>
      <ProfilePanelTitlebar look={L} onBack={sidebar?.showMenu} onClose={sidebar?.close} />
      <div className="flex flex-col px-4 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))]">
        <ProfileBody model={p} subscriptions={subscriptions} look={look} />
      </div>
    </div>
  );
}
