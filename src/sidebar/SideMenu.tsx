"use client";

/**
 * The side menu's contents - Figma 02 / 10-C (`43YI3MYtTfX5Xzz6dRoRuT`, frames 1410:2899,
 * 1867:3304, 1871:3057) - drawn in the sidebar's menu view (`./Sidebar.tsx`).
 *
 * ONE implementation since 2026-10-12 (it was minty-web's and a copy in
 * minty-payment-request-web). Everything that differs per app comes from the host (`../host.ts`):
 * where each item leads, which company and modules, what Logout owes, who is looking.
 *
 * Top to bottom: the Minty mark; THE PERSON (avatar + name), which switches the sidebar to My
 * Profile (the header's initials open it there directly); Select Entity; Manage subscriptions;
 * then, INSIDE A COMPANY only (02-D), its Petty
 * Cash and Payment Request sections; the cat, above the last group (the user's rule); and
 * Settings (inside a company only - never on the entity list) and Logout.
 *
 * Every `src="/menu/..."` below is served from the CONSUMER's `public/` - Next cannot serve a
 * static file out of node_modules. `SIDEBAR_ASSETS` in `../host.ts` is that list, and each app
 * tests its `public/` against it.
 */

import Image from "next/image";
import type { ReactNode } from "react";

import { requireSidebarHost, type ModuleAccess, type SideMenuCurrent, type Viewer } from "../host";
import { useViewer } from "../lib/viewer";
import { SIDEBAR_LOOK, type SidebarLookClasses } from "./looks";
import { useLook } from "./Sidebar";

export type MenuContext = {
  /**
   * Which modules the company has, when the page knows better than the token (the module
   * settings page reads them fresh). Omitted, the token's claims decide. A module that is off
   * gets no section.
   */
  modules?: ModuleAccess;
  /** The person looking, when the page already knows them; else read once per token. */
  viewer?: Viewer | null;
};

export type SideMenuProps = MenuContext & {
  /** Every link calls it as it navigates, and Logout before it leaves. */
  onClose: () => void;
  /**
   * The person's block. Given (inside the sidebar), it is a button that does this - switch to
   * My Profile, or just close on the profile page itself. Omitted, it is a link to `/profile`.
   */
  onProfile?: () => void;
};

// The classes are the look's (`./looks.ts`). v2: rows are 44 high at least, grey until hovered,
// and the page being shown (aria-current) is tinted as the selected row. classic: the original
// Figma 02 rows (Inter 500 18px #8f8f8f), the page being shown marked for assistive technology
// only. In both, the one tinted row otherwise is Bills, drawn as a button ("Bill Button").

function MenuLink({
  href,
  current,
  className,
  onNavigate,
  look: L,
  children,
}: {
  look: SidebarLookClasses;
  href: string;
  current: boolean;
  className: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={`${L.row} ${L.idle} ${className}`}
    >
      {children}
    </a>
  );
}

function Separator({ look: L }: { look: SidebarLookClasses }) {
  return <div className={L.separator} role="presentation" />;
}

/** Figma "Manage subscriptions": four outlined rings, placed as the design places them. */
function SubscriptionsIcon() {
  return (
    <span className="relative block h-[31px] w-[28px] shrink-0" aria-hidden>
      <Image
        className="absolute left-[3px] top-[4px]"
        src="/menu/subscriptions-ring.svg"
        alt=""
        width={22}
        height={23}
        unoptimized
      />
      <Image
        className="absolute left-0 top-0"
        src="/menu/subscriptions-dot-large.svg"
        alt=""
        width={16}
        height={16}
        unoptimized
      />
      <Image
        className="absolute left-[20px] top-[6px]"
        src="/menu/subscriptions-dot-small.svg"
        alt=""
        width={8}
        height={8}
        unoptimized
      />
      <Image
        className="absolute left-[6px] top-[21px]"
        src="/menu/subscriptions-dot-medium.svg"
        alt=""
        width={10}
        height={10}
        unoptimized
      />
    </span>
  );
}

function ModuleHeading({
  title,
  tone,
  icon,
  iconBox,
  look: L,
}: {
  look: SidebarLookClasses;
  title: ReactNode;
  tone: string;
  icon: { src: string; width: number; height: number };
  iconBox: string;
}) {
  return (
    <div className={L.moduleHeading}>
      <p className={`${L.moduleTitle} ${tone}`}>{title}</p>
      <span
        className={`flex size-[76px] shrink-0 items-center justify-center rounded-full ${iconBox}`}
        aria-hidden
      >
        <Image src={icon.src} alt="" width={icon.width} height={icon.height} unoptimized />
      </span>
    </div>
  );
}

/** Rendered only in the browser (inside the sidebar's portal), so the cookie and the URL exist. */
export function SideMenu({ modules, viewer, onClose, onProfile }: SideMenuProps) {
  const host = requireSidebarHost();
  const L = SIDEBAR_LOOK[useLook()];
  const person = useViewer(viewer);
  // Read off the URL, so every page gets it for free - and off `window.location`, not the app's
  // router hook: this is drawn inside the drawer's portal, in the browser only, and is re-rendered
  // each time the drawer opens, which is when the answer matters. (`host.usePathname()` is for the
  // provider, which must RE-RENDER on a move; here it would only add a subscription nothing uses,
  // and it would read null in a screen test that renders this menu with no router at all.)
  // What each route means is still the app's answer: host.currentOf.
  const current: SideMenuCurrent = host.currentOf(window.location.pathname);
  const entityId = host.entityId();
  // Inside a company only - and never on the entity list, where a person is choosing one.
  const inCompany = entityId !== "" && current !== "entities";
  // Read at every render, never memoised: the sidebar outlives a client-side move - the landing
  // stores a token after it has mounted - so a value kept from mount would describe no one.
  const access = modules ?? host.moduleAccess();

  // A page with unsaved changes asks first, and this is the one exit that needs saying so: it is
  // a button, so the leave guard's click rule never sees it, and logging out clears the token
  // BEFORE it navigates - a prompt answered with "stay" would leave the person on the page signed
  // out. The host owns both the asking and the leaving; `onClose` runs only once they have
  // committed, so "Go Back" leaves the menu as it was.
  const logout = () => host.logOut(onClose);
  const who = (
    <>
      <span className={L.avatar} aria-hidden>
        {person?.initials ?? ""}
      </span>
      <span className={L.name} aria-hidden>
        {person?.name ?? "My Profile"}
      </span>
    </>
  );
  const whoLabel = person ? `${person.name}, My Profile` : "My Profile";

  return (
    <nav className={L.nav} aria-label="Main navigation">
      <Image
        className={L.logo}
        src="/menu/minty-logo.svg"
        alt="Minty"
        width={99}
        height={71}
        unoptimized
      />

      {onProfile ? (
        <button
          type="button"
          onClick={onProfile}
          aria-current={current === "profile" ? "page" : undefined}
          aria-label={whoLabel}
          className={L.person}
        >
          {who}
        </button>
      ) : (
        <a
          href={host.links.profile()}
          onClick={onClose}
          aria-current={current === "profile" ? "page" : undefined}
          aria-label={whoLabel}
          className={L.person}
        >
          {who}
        </a>
      )}

      <div className={L.firstSeparator}>
        <Separator look={L} />
      </div>
      <div className={L.topLinks}>
        <MenuLink
          look={L}
          href={host.links.entities()}
          current={current === "entities"}
          onNavigate={onClose}
          className={L.selectEntity}
        >
          <span className="flex w-[28px] shrink-0 justify-center" aria-hidden>
            <Image src="/menu/select-entity.svg" alt="" width={22} height={20} unoptimized />
          </span>
          Select Entity
        </MenuLink>
        <MenuLink
          look={L}
          href={host.links.subscriptions()}
          current={current === "subscriptions"}
          onNavigate={onClose}
          className={L.subscriptions}
        >
          <SubscriptionsIcon />
          <span className="max-w-[130px]">Manage subscriptions</span>
        </MenuLink>
      </div>
      <div className={L.secondSeparator}>
        <Separator look={L} />
      </div>

      {inCompany && (access.pettyCash || access.billing) ? (
        <div className="flex flex-col">
          {access.pettyCash ? (
            <div className={L.pettyGroup} role="group" aria-label="Petty Cash">
              <ModuleHeading
                look={L}
                title="Petty Cash"
                tone={L.pettyTone}
                icon={{ src: "/menu/petty-cash.svg", width: 42, height: 45 }}
                iconBox={L.pettyIconBox}
              />
              <MenuLink
                look={L}
                href={host.links.pettyCashDashboard()}
                current={false}
                onNavigate={onClose}
                className={L.dashboard}
              >
                <Image
                  src="/menu/dashboard.svg"
                  alt=""
                  width={23}
                  height={23}
                  unoptimized
                  aria-hidden
                />
                Dashboard
              </MenuLink>
              <MenuLink
                look={L}
                href={host.links.pettyCashReports(entityId)}
                current={false}
                onNavigate={onClose}
                className={L.reports}
              >
                <Image
                  src="/menu/reports.svg"
                  alt=""
                  width={23}
                  height={23}
                  unoptimized
                  aria-hidden
                />
                Reports
              </MenuLink>
            </div>
          ) : null}
          {access.pettyCash && access.billing ? (
            <div className={L.moduleSeparator}>
              <Separator look={L} />
            </div>
          ) : null}
          {access.billing ? (
            <div className={L.paymentGroup} role="group" aria-label="Payment Request">
              <ModuleHeading
                look={L}
                title={
                  <>
                    Payment
                    <br aria-hidden /> Request
                  </>
                }
                tone={L.paymentTone}
                icon={{ src: "/menu/payment-request.svg", width: 76, height: 76 }}
                iconBox=""
              />
              <a
                href={host.links.bills()}
                onClick={onClose}
                className={`${L.row} ${L.button} ${L.bills}`}
              >
                <Image
                  src="/menu/bills.svg"
                  alt=""
                  width={27}
                  height={20}
                  unoptimized
                  aria-hidden
                />
                Bills
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={L.spacer} aria-hidden />
      {/* The cat sits above Settings and Logout on every page (the user's rule, 2026-09-29) -
          decoration, not navigation. Flask's own side panel draws the same one. */}
      <div className={L.cat}>
        <Image
          src="/menu/sidepanel_cat.webp"
          alt=""
          width={1370}
          height={1101}
          className="h-auto w-[min(100%,10rem)] select-none object-contain"
          draggable={false}
          unoptimized
        />
      </div>
      <Separator look={L} />
      <div className={L.bottomLinks}>
        {inCompany ? (
          <MenuLink
            look={L}
            href={host.links.settings()}
            current={current === "settings"}
            onNavigate={onClose}
            className={L.settings}
          >
            <span className="flex size-[31px] shrink-0 items-center justify-center" aria-hidden>
              <Image
                className="-scale-y-100"
                src="/menu/settings.svg"
                alt=""
                width={27}
                height={27}
                unoptimized
              />
            </span>
            Settings
          </MenuLink>
        ) : null}
        <button type="button" onClick={logout} className={`${L.row} ${L.idle} ${L.logout}`}>
          <span className="flex size-[31px] shrink-0 items-center justify-center" aria-hidden>
            <Image src="/menu/logout.svg" alt="" width={23} height={23} unoptimized />
          </span>
          Logout
        </button>
      </div>
    </nav>
  );
}
