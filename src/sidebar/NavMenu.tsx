"use client";

/**
 * The header's ≡ - the "sandwich" - on every page of every app that mounts it: it opens the
 * sidebar on the side menu (Figma 02 / 10-C, `./SideMenu.tsx`; it replaced
 * minty-payment-request-web's own drawer on 2026-09-29). The sidebar belongs to the layout (`SidebarProvider`); this button tells it the
 * page's own knowledge for the menu (fresh modules, a known viewer) and opens it.
 *
 * Rendered where no provider is (a screen on its own, as the screen tests render them), it
 * keeps a drawer of its own with the menu only, whose person block is a link to `/profile`.
 */

import Image from "next/image";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { SideMenu, type MenuContext } from "./SideMenu";
import { SidebarDrawer, useMounted, useSidebar } from "./Sidebar";

export type NavMenuProps = MenuContext;

export function NavMenu({ modules, viewer }: NavMenuProps) {
  const sidebar = useSidebar();
  const setMenuContext = sidebar?.setMenuContext;
  const mounted = useMounted();
  const trigger = useRef<HTMLButtonElement>(null);
  const localPanelId = useId();
  const [localOpen, setLocalOpen] = useState(false);
  const closeLocal = useCallback(() => setLocalOpen(false), []);

  useEffect(() => {
    setMenuContext?.({ modules, viewer });
  }, [setMenuContext, modules, viewer]);

  const expanded = sidebar ? sidebar.open && sidebar.view === "menu" : localOpen;

  return (
    // Under a railed provider the menu is always on screen from 1280px, so the ≡ goes there.
    <div className={`flex shrink-0 items-center ${sidebar?.rail ? "xl:hidden" : ""}`}>
      <button
        ref={trigger}
        type="button"
        onClick={() => (sidebar ? sidebar.openMenu(trigger.current) : setLocalOpen(true))}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-lg transition-colors duration-100 hover:bg-state-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        aria-expanded={expanded}
        aria-controls={sidebar ? sidebar.panelId : localPanelId}
        aria-label="Open navigation menu"
      >
        <Image src="/menu/menu.svg" alt="" width={29} height={32} unoptimized aria-hidden />
      </button>
      {!sidebar && mounted
        ? createPortal(
            <SidebarDrawer
              open={localOpen}
              view="menu"
              panelId={localPanelId}
              opener={trigger}
              onClose={closeLocal}
            >
              <SideMenu modules={modules} viewer={viewer} onClose={closeLocal} />
            </SidebarDrawer>,
            document.body,
          )
        : null}
    </div>
  );
}
