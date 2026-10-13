"use client";

/**
 * The sidebar - ONE drawer on the right with two views (the user's call, 2026-09-29):
 *
 * - the MENU (Figma 02 / 10-C, `SideMenu`), opened by the header's ≡;
 * - MY PROFILE (Figma 10-A), opened by the header's initials, or from the menu by the person's
 *   name; its ‹ goes back to the menu.
 *
 * Nothing navigates to open it: it slides over whatever page is showing and closes back onto
 * it (Escape, a click beside it) - or by itself when a link inside it moves this app to another
 * page (the layout, and so the sidebar, outlives a client-side move). 353 px for the menu,
 * 440 px for the profile from 640 px up (10-A is drawn at 375; the user asked for more room, so
 * an ordinary email shows whole) - and on a phone the whole screen, as 10-A is drawn.
 *
 * `SidebarProvider` holds it for every page (`app/layout.tsx`). The profile view is a SLOT
 * the shell fills with the profile feature's panel - shared chrome never reaches into a
 * feature - and is mounted only once asked for, so nothing is read before then.
 *
 * Without a provider (a screen rendered on its own, as the screen tests do) the ≡ keeps a
 * drawer of its own with the menu only, and the initials and the menu's name are links to the
 * `/profile` page - a page can never lose its menu. That page stays for Minty's `/profile`
 * router and the links that still use it.
 *
 * ONE implementation since 2026-10-12, shared by every app that mounts it. Two things differ per
 * app and come from the host (`../host.ts`): how the page's scroll is held, and which path is the
 * profile page (minty-payment-request-web has none).
 */

import { createPortal } from "react-dom";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";

import { requireSidebarHost } from "../host";
import { SideMenu, type MenuContext } from "./SideMenu";

export type SidebarView = "menu" | "profile";

export type SidebarControls = {
  open: boolean;
  view: SidebarView;
  /** The drawer's id - what the openers name in `aria-controls`. */
  panelId: string;
  /** ≡: open on the menu. `opener` takes the focus back when the sidebar closes. */
  openMenu: (opener?: HTMLElement | null) => void;
  /** The header's initials: open on My Profile. */
  openProfile: (opener?: HTMLElement | null) => void;
  /** My Profile's ‹: back to the menu. */
  showMenu: () => void;
  close: () => void;
  /** The page's own knowledge for the menu (fresh modules, a known viewer) - set by its ≡. */
  setMenuContext: (context: MenuContext) => void;
  /** Whether My Profile opens in here - the shell filled the slot. Else it is the `/profile` page. */
  canOpenProfile: boolean;
  /** The menu stands as a rail on the right from 1280px (the provider's `rail`); the ≡ hides there. */
  rail: boolean;
};

/**
 * What a page under a railed provider adds to its outer frame, so nothing sits under the
 * 280px rail from 1280px up. A class string, not a number: it lives in this package's source,
 * so the consumer's `@source` line makes Tailwind generate it.
 */
export const SIDEBAR_RAIL_OFFSET = "xl:pr-[280px]";

const SidebarContext = createContext<SidebarControls | null>(null);

/** The sidebar, or null outside a provider (the openers then fall back - see above). */
export function useSidebar(): SidebarControls | null {
  return useContext(SidebarContext);
}

// The drawer is a portal, and the cookie and the URL its menu reads exist only in the browser:
// "mounted" is the server/client seam.
const noSubscribe = () => () => {};
const clientTrue = () => true;
const serverFalse = () => false;

export function useMounted(): boolean {
  return useSyncExternalStore(noSubscribe, clientTrue, serverFalse);
}

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled])";

/**
 * The drawer itself: the washed-out page behind (a click on it closes), the panel sliding in
 * from the right, the page's scroll held, Escape to close, the keyboard moved inside on
 * opening (and to the new view's first control on switching) and back to the opener after.
 */
export function SidebarDrawer({
  open,
  view,
  panelId,
  opener,
  onClose,
  children,
}: {
  open: boolean;
  view: SidebarView;
  panelId: string;
  opener: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const host = requireSidebarHost();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // How the page is held still is the app's own: minty-web locks `body`, while
    // minty-payment-request-web must lock `#app-scroll-root` because below 1280 px its
    // `html`/`body` are `position: fixed` and a body lock would do nothing there.
    const release = host.lockScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const back = opener.current;
    return () => {
      release();
      window.removeEventListener("keydown", onKey);
      back?.focus();
    };
  }, [open, opener, onClose, host]);

  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open, view]);

  const profile = view === "profile";
  return (
    <div
      className={`fixed inset-0 z-[200] overflow-x-hidden overscroll-x-none ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
      // closed, nothing in it takes the keyboard's focus either
      inert={!open}
    >
      {/* Part 13 overlay/scrim (48% Light): the page behind dims; a click on it closes the sidebar */}
      <button
        type="button"
        className={`absolute inset-0 cursor-pointer bg-overlay-scrim transition-opacity duration-300 ease-(--ease-standard) ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        aria-label={profile ? "Close My Profile" : "Close menu"}
      />
      {/* Part 14 Sidebar: a 280px sheet from the right (elevation 2, surface/raised); My Profile
          keeps its 440px from 640px up and the whole screen on a phone. */}
      <div
        id={panelId}
        ref={panel}
        className={`absolute right-0 top-0 h-full overflow-y-auto overscroll-contain border-l border-border-default shadow-modal transition-[transform,width] duration-300 ease-(--ease-standard) ${profile ? "w-full bg-surface-sunk sm:w-[440px]" : "w-[min(100%,280px)] bg-surface-raised"} ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {children}
      </div>
    </div>
  );
}

// `at`: the page it was opened on. Open means open ON THIS PAGE - a move elsewhere closes it
// without an effect having to notice.
type State = { open: boolean; view: SidebarView; at: string | null };

// By value: a page passing `modules={{...}}` inline must not re-set the context every render.
const sameContext = (a: MenuContext, b: MenuContext) =>
  (a.modules === b.modules ||
    (!!a.modules &&
      !!b.modules &&
      a.modules.pettyCash === b.modules.pettyCash &&
      a.modules.billing === b.modules.billing)) &&
  (a.viewer === b.viewer ||
    (!!a.viewer &&
      !!b.viewer &&
      a.viewer.name === b.viewer.name &&
      a.viewer.initials === b.viewer.initials));

export function SidebarProvider({
  profile,
  rail = false,
  children,
}: {
  /** My Profile's view - the profile feature's panel, composed in by the shell. */
  profile?: ReactNode;
  /**
   * Part 14 / 15 "One layout" (D14-15): from 1280px the menu is a fixed 280px rail on the right,
   * always there; below that it stays the sheet the ≡ opens. Opt-in, so an app adopts it when its
   * page frame carries `SIDEBAR_RAIL_OFFSET`.
   */
  rail?: boolean;
  children: ReactNode;
}) {
  const host = requireSidebarHost();
  const mounted = useMounted();
  const pathname = host.usePathname();
  const panelId = useId();
  const opener = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<State>({ open: false, view: "menu", at: null });
  const [menuContext, setMenuContextState] = useState<MenuContext>({});
  const open = state.open && state.at === pathname;
  const view = state.view;

  const openAt = useCallback(
    (next: SidebarView, from?: HTMLElement | null) => {
      opener.current =
        from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      setState({ open: true, view: next, at: pathname });
    },
    [pathname],
  );
  const openMenu = useCallback((from?: HTMLElement | null) => openAt("menu", from), [openAt]);
  const openProfile = useCallback((from?: HTMLElement | null) => openAt("profile", from), [openAt]);
  const showMenu = useCallback(() => setState((s) => ({ ...s, view: "menu" })), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const setMenuContext = useCallback((next: MenuContext) => {
    setMenuContextState((current) => (sameContext(current, next) ? current : next));
  }, []);

  const canOpenProfile = profile != null;
  const controls = useMemo<SidebarControls>(
    () => ({
      open,
      view,
      panelId,
      openMenu,
      openProfile,
      showMenu,
      close,
      setMenuContext,
      canOpenProfile,
      rail,
    }),
    [
      open,
      view,
      panelId,
      openMenu,
      openProfile,
      showMenu,
      close,
      setMenuContext,
      canOpenProfile,
      rail,
    ],
  );

  // The menu's name: My Profile in place - or, on the profile page itself, just close. An app
  // with no profile page of its own never reports "profile", so it always switches the view.
  const toProfile = useCallback(() => {
    if (host.currentOf(pathname) === "profile") close();
    else setState((s) => ({ ...s, view: "profile" }));
  }, [pathname, close, host]);

  // The rail's person block opens My Profile in the sheet (or the page, without a profile slot).
  const railProfile = useCallback(() => {
    if (canOpenProfile && host.currentOf(pathname) !== "profile") openAt("profile");
  }, [canOpenProfile, host, pathname, openAt]);

  return (
    <SidebarContext.Provider value={controls}>
      {children}
      {mounted && rail ? (
        <aside
          className="fixed inset-y-0 right-0 z-[100] hidden w-[280px] overflow-y-auto overscroll-contain border-l border-border-subtle bg-surface-card xl:block"
          aria-label="Sidebar"
          data-sidebar-rail=""
        >
          <SideMenu
            {...menuContext}
            onClose={() => {}}
            onProfile={canOpenProfile ? railProfile : undefined}
          />
        </aside>
      ) : null}
      {mounted
        ? createPortal(
            <SidebarDrawer
              open={open}
              view={view}
              panelId={panelId}
              opener={opener}
              onClose={close}
            >
              {view === "profile" ? (
                <section className="flex min-h-full flex-col" aria-label="My Profile">
                  {profile}
                </section>
              ) : (
                <SideMenu
                  {...menuContext}
                  onClose={close}
                  onProfile={canOpenProfile ? toProfile : undefined}
                />
              )}
            </SidebarDrawer>,
            document.body,
          )
        : null}
    </SidebarContext.Provider>
  );
}
