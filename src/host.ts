/**
 * What the packaged sidebar needs from the app it is rendering in - and the only thing that
 * differs between them.
 *
 * Until 2026-10-12 the sidebar was two hand-maintained copies: minty-web's reached straight into
 * `@/lib/{auth,env,hubPaths,leaveGuard,logout,mintyEntry,moduleClaims}`, and
 * minty-payment-request-web's copy reached one file of its own,
 * `components/ui/sidebarHost.ts`, which existed to hold exactly these answers. That file was the
 * design for this type (`modernisation_plan.md`: "that file is the list of what @minty/shared
 * must take as injection"), so this is its shape, and each app now supplies one.
 *
 * A module-level registry rather than a React provider, for two reasons that are not style:
 * every app's `app/layout.tsx` is a SERVER component, so functions cannot be handed across that
 * boundary as props; and `lib/viewer.ts` is a module-level store whose reads happen outside any
 * React tree, where no context can reach. Each app registers its host from the module that every
 * shim imports for the side effect, so the host is always set before anything renders.
 *
 * No silent default: an unregistered host throws, naming the file to go and write.
 */

/** Which modules a company has. Both true when unknown - never hide nav on a guess. */
export type ModuleAccess = { pettyCash: boolean; billing: boolean };

/** Which menu item is the page being shown, for `aria-current` and the profile-page case. */
export type SideMenuCurrent = "profile" | "entities" | "subscriptions" | "settings" | null;

/** The person looking: what the header's badge and the menu's person block show. */
export type Viewer = { name: string; initials: string };

/**
 * Where each item of the menu leads FROM THIS APP. Functions, not strings: most read the cookie
 * at the moment of the click, and the sidebar outlives a client-side move.
 */
export type SidebarLinks = {
  /** The entity list (minty-web's own page; a re-handoff from anywhere else). */
  entities(): string;
  subscriptions(): string;
  pettyCashDashboard(): string;
  pettyCashReports(entityId: string): string;
  bills(): string;
  /** Settings of the app the menu was pressed in (the user's call, 2026-09-30). */
  settings(): string;
  profile(): string;
};

export type SidebarHost = {
  /**
   * Which app this host belongs to ("minty-web", "minty-payment-request-web"). Named, not
   * anonymous, because it is what `setSidebarHost` guards on and what its error can say.
   */
  app: string;
  /** The company in this app's cookie ("" when none). */
  entityId(): string;
  /** The company's name, for the links that spell it. */
  entityName(): string;
  moduleAccess(): ModuleAccess;
  links: SidebarLinks;
  /**
   * THIS APP'S ROUTER, as a hook - call it during render, like any hook.
   *
   * The package does not import `next/navigation` itself, and that is deliberate rather than
   * tidiness: a mock of it in a consumer's test (`vi.mock("next/navigation")`) does NOT reach a
   * module inside node_modules, so a packaged component that imported the router directly read
   * the real one and got `null` outside an app-router tree - the sidebar then never closed on a
   * move between pages, and only an app's own test could see it. Asking the app means the app's
   * own mock applies, and the package needs no Next at all for this.
   *
   * Return "" when the path is unknown, never null.
   */
  usePathname(): string;
  currentOf(pathname: string): SideMenuCurrent;
  /** Hold the page still while the drawer is open; the returned function lets it go. */
  lockScroll(): () => void;
  /**
   * This app's logout, including any "Leave without saving?" it owes. `onLeaving` runs only once
   * the person has committed to going - it closes the drawer - so "Go Back" leaves them on the
   * page, still signed in, with the menu as it was.
   */
  logOut(onLeaving?: () => void): void;
  /** The token the viewer read is cached by. */
  currentToken(): string;
  /** The person looking, from this app's own reach into Flask's `GET /api/me/profile`. */
  loadViewer(): Promise<Viewer | null>;
};

/**
 * Every file under `public/` the packaged sidebar renders. Next.js cannot serve a static file out
 * of node_modules, so these stay in each app - which makes them a contract, and a silent one: a
 * missing file is a broken image, not an error. Each consumer asserts this list against its own
 * `public/` in a test (see the README), so "I forgot the asset" fails a run instead of a page.
 */
export const SIDEBAR_ASSETS = [
  "/menu/menu.svg",
  "/menu/minty-logo.svg",
  "/menu/select-entity.svg",
  "/menu/subscriptions-ring.svg",
  "/menu/subscriptions-dot-large.svg",
  "/menu/subscriptions-dot-medium.svg",
  "/menu/subscriptions-dot-small.svg",
  "/menu/petty-cash.svg",
  "/menu/dashboard.svg",
  "/menu/reports.svg",
  "/menu/payment-request.svg",
  "/menu/bills.svg",
  "/menu/sidepanel_cat.webp",
  "/menu/settings.svg",
  "/menu/logout.svg",
] as const;

let host: SidebarHost | null = null;

/**
 * Register this app's host. Called for its side effect by the module each shim imports, so it runs
 * before any packaged component does.
 *
 * Guarded on `app`, NOT on object identity. Identity looked tidier and was wrong: Next evaluates a
 * module once per bundler layer and again on every HMR edit, so one host file legitimately
 * produces a fresh object literal several times in a single page - an identity check threw "a
 * second, different sidebar host" on an ordinary dev reload. Re-registering the same app REPLACES
 * the host, which is what HMR needs: the old object closes over the modules it was built from.
 *
 * Two different apps in one page is still refused - whichever lost would be a mystery.
 */
export function setSidebarHost(next: SidebarHost): void {
  if (host && host.app !== next.app) {
    throw new Error(
      `@minty/shared: ${next.app} tried to register a sidebar host while ${host.app}'s was in ` +
        "place - one page, one app.",
    );
  }
  host = next;
}

export function requireSidebarHost(): SidebarHost {
  if (!host) {
    throw new Error(
      "@minty/shared: no sidebar host. This app must call setSidebarHost(...) before the sidebar " +
        "renders - write it in its components/ui/sidebarHost.ts and import that file from the shim.",
    );
  }
  return host;
}

/** Test seam: forget the registered host between test files. */
export function _resetSidebarHostForTests(): void {
  host = null;
}
