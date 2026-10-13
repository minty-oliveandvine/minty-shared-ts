/**
 * The sidebar's public surface: the provider and drawer, the menu, the header's two openers, and
 * the host every app registers.
 *
 * An app imports from here, never from the files - the same rule minty-web's feature folders
 * follow (`features/<name>/index.ts` is the whole public surface).
 */

export {
  SidebarProvider,
  SidebarDrawer,
  SIDEBAR_RAIL_OFFSET,
  useSidebar,
  useMounted,
  type SidebarControls,
  type SidebarView,
} from "./Sidebar";
export { SideMenu, type MenuContext, type SideMenuProps } from "./SideMenu";
export { NavMenu, type NavMenuProps } from "./NavMenu";
export { ViewerBadge } from "./ViewerBadge";
export {
  setSidebarHost,
  requireSidebarHost,
  SIDEBAR_ASSETS,
  type ModuleAccess,
  type SideMenuCurrent,
  type SidebarHost,
  type SidebarLinks,
  type Viewer,
} from "../host";
