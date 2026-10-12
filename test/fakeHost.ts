/**
 * A SidebarHost for tests: every answer stubbed, each one settable.
 *
 * The package has no cookie jar, no env and no fetch of its own - that is the whole point of the
 * host - so this is the only wiring its tests need. `test/setup.ts` installs a fresh one before
 * every test, so a test that does not care about the host never mentions it.
 */

import { vi } from "vitest";

import {
  _resetSidebarHostForTests,
  setSidebarHost,
  type ModuleAccess,
  type SideMenuCurrent,
  type SidebarHost,
  type Viewer,
} from "../src/host";

export type FakeHost = SidebarHost & {
  setToken(token: string): void;
  setEntity(id: string, name?: string): void;
  setModules(access: ModuleAccess): void;
  setCurrent(current: SideMenuCurrent): void;
  /** The release function the last `lockScroll()` handed back. */
  released(): number;
};

export function installFakeHost(overrides: Partial<SidebarHost> = {}): FakeHost {
  let token = "";
  let entityId = "";
  let entityName = "";
  let modules: ModuleAccess = { pettyCash: true, billing: true };
  let current: SideMenuCurrent = null;
  let releases = 0;

  const host: SidebarHost = {
    app: "test",
    entityId: () => entityId,
    entityName: () => entityName,
    moduleAccess: () => modules,
    links: {
      entities: () => "/entities",
      subscriptions: () => "/subscription",
      pettyCashDashboard: () => "https://minty.test/entity/e1/enter",
      pettyCashReports: (id: string) => `https://minty.test/entity/${id}/petty-cash/reports`,
      bills: () => "https://bills.test/",
      settings: () => "/entity/abcd1234/acme/settings/modules",
      profile: () => "/profile",
    },
    usePathname: () => window.location.pathname,
    currentOf: () => current,
    lockScroll: () => () => {
      releases += 1;
    },
    logOut: vi.fn(),
    currentToken: () => token,
    loadViewer: (): Promise<Viewer | null> => Promise.resolve(null),
    ...overrides,
  };

  _resetSidebarHostForTests();
  setSidebarHost(host);

  return Object.assign(host, {
    setToken: (next: string) => {
      token = next;
    },
    setEntity: (id: string, name = "") => {
      entityId = id;
      entityName = name;
    },
    setModules: (next: ModuleAccess) => {
      modules = next;
    },
    setCurrent: (next: SideMenuCurrent) => {
      current = next;
    },
    released: () => releases,
  });
}
