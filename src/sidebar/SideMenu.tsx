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

// Part 14 "Sidebar · Nav item" (v1.1, 7 Oct 2026): 44px items in a 280px panel, States Default |
// Hover | Active | Focus, `aria-current=page` on the page being shown - now drawn as Active
// (state/selected fill, link ink), where the old Figma 02-A drew it grey. Bills keeps its tint
// (the design's "Bill Button"), in the same Active tokens. Colours are Part 13 semantic tokens
// from `@minty/shared/tokens.css`, which every consumer imports.
const ROW =
  "flex w-full items-center rounded-lg text-body-l font-medium transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";
const IDLE =
  "text-text-secondary hover:bg-state-hover aria-[current=page]:bg-state-selected aria-[current=page]:font-semibold aria-[current=page]:text-text-link";
const BUTTON = "bg-state-selected font-semibold text-text-link hover:bg-state-selected/80";

function MenuLink({
  href,
  current,
  className,
  onNavigate,
  children,
}: {
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
      className={`${ROW} ${IDLE} ${className}`}
    >
      {children}
    </a>
  );
}

function Separator() {
  return <div className="h-px w-full shrink-0 bg-border-subtle" role="presentation" />;
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
}: {
  title: ReactNode;
  tone: string;
  icon: { src: string; width: number; height: number };
  iconBox: string;
}) {
  return (
    // Part 14 Module chip: a 32px circle in the module's wash, the name in its ink.
    <div className="flex items-center gap-3 px-3">
      <span
        className={`flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full ${iconBox}`}
        aria-hidden
      >
        <Image src={icon.src} alt="" width={icon.width} height={icon.height} unoptimized />
      </span>
      <p className={`text-label uppercase ${tone}`}>{title}</p>
    </div>
  );
}

const PERSON =
  "mt-6 flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-1 text-left transition-colors duration-100 hover:bg-state-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

/** Rendered only in the browser (inside the sidebar's portal), so the cookie and the URL exist. */
export function SideMenu({ modules, viewer, onClose, onProfile }: SideMenuProps) {
  const host = requireSidebarHost();
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
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-avatar-bg text-title-m text-accent-avatar-ink"
        aria-hidden
      >
        {person?.initials ?? ""}
      </span>
      <span className="min-w-0 break-words text-title-m text-text-primary" aria-hidden>
        {person?.name ?? "My Profile"}
      </span>
    </>
  );
  const whoLabel = person ? `${person.name}, My Profile` : "My Profile";

  return (
    <nav
      className="flex min-h-full flex-col px-4 pt-[max(24px,env(safe-area-inset-top,0px))] pb-[max(24px,env(safe-area-inset-bottom,0px))]"
      aria-label="Main navigation"
    >
      <Image
        className="mx-auto h-auto w-[72px] shrink-0"
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
          className={PERSON}
        >
          {who}
        </button>
      ) : (
        <a
          href={host.links.profile()}
          onClick={onClose}
          aria-current={current === "profile" ? "page" : undefined}
          aria-label={whoLabel}
          className={PERSON}
        >
          {who}
        </a>
      )}

      <div className="mt-4">
        <Separator />
      </div>
      <div className="mt-3 flex flex-col gap-1">
        <MenuLink
          href={host.links.entities()}
          current={current === "entities"}
          onNavigate={onClose}
          className="min-h-11 gap-3 px-3"
        >
          <span className="flex w-7 shrink-0 justify-center" aria-hidden>
            <Image src="/menu/select-entity.svg" alt="" width={22} height={20} unoptimized />
          </span>
          Select Entity
        </MenuLink>
        <MenuLink
          href={host.links.subscriptions()}
          current={current === "subscriptions"}
          onNavigate={onClose}
          className="min-h-11 gap-3 px-3"
        >
          <SubscriptionsIcon />
          <span className="min-w-0">Manage subscriptions</span>
        </MenuLink>
      </div>
      <div className="mt-3">
        <Separator />
      </div>

      {inCompany && (access.pettyCash || access.billing) ? (
        <div className="flex flex-col">
          {access.pettyCash ? (
            <div className="mt-4 flex flex-col gap-1" role="group" aria-label="Petty Cash">
              <ModuleHeading
                title="Petty Cash"
                tone="text-module-pettycash-ink"
                icon={{ src: "/menu/petty-cash.svg", width: 18, height: 19 }}
                iconBox="bg-module-pettycash-wash"
              />
              <MenuLink
                href={host.links.pettyCashDashboard()}
                current={false}
                onNavigate={onClose}
                className="mt-2 min-h-11 gap-3 px-3"
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
                href={host.links.pettyCashReports(entityId)}
                current={false}
                onNavigate={onClose}
                className="min-h-11 gap-3 px-3"
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
            <div className="mt-4">
              <Separator />
            </div>
          ) : null}
          {access.billing ? (
            <div className="mt-4 flex flex-col gap-1" role="group" aria-label="Payment Request">
              <ModuleHeading
                title="Payment Request"
                tone="text-module-payment-ink"
                icon={{ src: "/menu/payment-request.svg", width: 32, height: 32 }}
                iconBox="bg-module-payment-wash"
              />
              <a
                href={host.links.bills()}
                onClick={onClose}
                className={`${ROW} ${BUTTON} mt-2 min-h-11 gap-3 px-3`}
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

      <div className="min-h-6 flex-1" aria-hidden />
      {/* The cat sits above Settings and Logout on every page (the user's rule, 2026-09-29) -
          decoration, not navigation. Flask's own side panel draws the same one. */}
      <div className="flex shrink-0 justify-center pb-4">
        <Image
          src="/menu/sidepanel_cat.webp"
          alt=""
          width={1370}
          height={1101}
          className="h-auto w-[min(100%,7.5rem)] select-none object-contain"
          draggable={false}
          unoptimized
        />
      </div>
      <Separator />
      <div className="mt-3 flex flex-col gap-1">
        {inCompany ? (
          <MenuLink
            href={host.links.settings()}
            current={current === "settings"}
            onNavigate={onClose}
            className="min-h-11 gap-3 px-3"
          >
            <span className="flex size-7 shrink-0 items-center justify-center" aria-hidden>
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
        <button
          type="button"
          onClick={logout}
          className={`${ROW} ${IDLE} min-h-11 cursor-pointer gap-3 px-3 text-left`}
        >
          <span className="flex size-7 shrink-0 items-center justify-center" aria-hidden>
            <Image src="/menu/logout.svg" alt="" width={23} height={23} unoptimized />
          </span>
          Logout
        </button>
      </div>
    </nav>
  );
}
