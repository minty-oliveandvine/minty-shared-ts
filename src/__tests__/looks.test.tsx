// The two designs (the owner, 2026-10-20): one implementation, the look's classes reaching every
// part - the ≡, the badge, the drawer, the menu, My Profile and its Subscriptions Overview. A slot
// wired to the wrong look, or a class left behind from the other, fails here.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { installFakeHost } from "../../test/fakeHost";
import { _setViewerLoaderForTests } from "../lib/viewer";
import { PROFILE_LOOK } from "../profile/looks";
import { SCOPED } from "../profile/fixtures";
import { ProfilePanel, SubscriptionsOverviewCard, type ProfileApi } from "../profile";
import { NavMenu, SidebarProvider, SIDEBAR_LOOK, ViewerBadge, type Look } from "../sidebar";

const has = (el: Element, classes: string) =>
  classes
    .split(/\s+/)
    .filter(Boolean)
    .every((c) => el.classList.contains(c));

const api: ProfileApi = {
  load: () => Promise.resolve(SCOPED),
  save: () => Promise.resolve(SCOPED),
};
const load = () =>
  Promise.resolve({ entities: [{ modules: [{ status: "active", date_iso: "2026-12-01" }] }] });

function show(look?: Look) {
  render(
    <SidebarProvider
      look={look}
      profile={
        <ProfilePanel
          api={api}
          notify={vi.fn()}
          subscriptions={
            <SubscriptionsOverviewCard load={load} today={new Date("2026-10-20T03:00:00Z")} />
          }
        />
      }
    >
      <ViewerBadge />
      <NavMenu />
    </SidebarProvider>,
  );
}

describe("the two looks", () => {
  beforeEach(() => {
    const host = installFakeHost();
    host.setToken("t1");
    host.setEntity("e-company-a", "Company A Limited");
    window.history.replaceState({}, "", "/entity/abcd/acme/petty-cash");
    _setViewerLoaderForTests(() =>
      Promise.resolve({ name: SCOPED.user.name, initials: SCOPED.user.initials }),
    );
  });

  it.each<Look>(["v2", "classic"])(
    "%s: every part draws with its own look's classes",
    async (look) => {
      const S = SIDEBAR_LOOK[look];
      const P = PROFILE_LOOK[look];
      show(look);

      const menuButton = screen.getByRole("button", { name: "Open navigation menu" });
      expect(has(menuButton, S.menuButton)).toBe(true);
      const badge = await screen.findByRole("button", { name: `${SCOPED.user.name}, My Profile` });
      expect(has(badge, S.badge)).toBe(true);

      await userEvent.click(menuButton);
      const nav = screen.getByRole("navigation", { name: "Main navigation" });
      expect(has(nav, S.nav)).toBe(true);
      expect(
        has(
          within(nav).getByRole("link", { name: "Select Entity" }),
          `${S.row} ${S.idle} ${S.selectEntity}`,
        ),
      ).toBe(true);
      expect(has(nav.parentElement!, `${S.sheet} ${S.sheetMenu} ${S.sheetOpen}`)).toBe(true);

      await userEvent.click(
        within(nav).getByRole("button", { name: `${SCOPED.user.name}, My Profile` }),
      );
      const sheet = within(screen.getByRole("region", { name: "My Profile" }));
      const name = await sheet.findByRole("heading", { level: 2, name: SCOPED.user.name });
      expect(has(name, P.heroName)).toBe(true);
      expect(has(sheet.getByRole("region", { name: "Your details" }), P.card)).toBe(true);
      expect(has(sheet.getByRole("button", { name: "Edit" }), P.editButton)).toBe(true);
      expect(has(sheet.getByText("Shop Manager"), P.role)).toBe(true);
      const overview = await sheet.findByRole("link", { name: "Manage Subscription" });
      expect(has(overview, P.manage)).toBe(true);
      expect(has(sheet.getByRole("button", { name: "Log Out" }), P.logOut)).toBe(true);
      expect(sheet.queryByText(/password/i)).toBeNull();
    },
  );

  it("the default is v2, so a v0.5 consumer sees no change", async () => {
    show();
    const badge = await screen.findByRole("button", { name: `${SCOPED.user.name}, My Profile` });
    expect(has(badge, SIDEBAR_LOOK.v2.badge)).toBe(true);
  });

  it("classic needs nothing from Part 13: no semantic token class in either map", () => {
    const part13 =
      /\b(?:bg|text|border|ring|outline)-(?:surface|text|border|action|state|status|accent|module|overlay|brand)-/;
    for (const map of [SIDEBAR_LOOK.classic, PROFILE_LOOK.classic]) {
      for (const [slot, classes] of Object.entries(map)) {
        expect(classes ?? "", `classic.${slot}`).not.toMatch(part13);
        expect(classes ?? "", `classic.${slot}`).not.toMatch(/\brounded-(?:sm|md|lg|xl)\b/);
      }
    }
  });
});
