"use client";

import type { Look } from "../sidebar/looks";
import { useLook } from "../sidebar/Sidebar";
import { PROFILE_LOOK, type ProfileLookClasses } from "./looks";

/**
 * The profile's classes for the design in force: an explicit `look` (minty-web's `/profile` page,
 * drawn outside any sidebar) or else the sidebar provider's (`v2` outside one).
 */
export function useProfileLook(look?: Look): ProfileLookClasses {
  const fromSidebar = useLook();
  return PROFILE_LOOK[look ?? fromSidebar];
}
