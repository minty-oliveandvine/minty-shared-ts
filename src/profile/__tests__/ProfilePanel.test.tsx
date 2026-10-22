// My Profile in the packaged sidebar: the badge opens it over the page (nothing navigates), it
// reads the profile through the app's `api` only then, edits in place, and its titlebar goes back
// to the menu or closes. Each app's own wiring - its fetch, its toast - is tested in that app.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { installFakeHost, type FakeHost } from "../../../test/fakeHost";
import { _setViewerLoaderForTests } from "../../lib/viewer";
import type { Look } from "../../sidebar/looks";
import { SidebarProvider } from "../../sidebar/Sidebar";
import { ViewerBadge } from "../../sidebar/ViewerBadge";
import { SCOPED, UNSCOPED } from "../fixtures";
import { PROFILE_ASSETS, ProfilePanel, type Profile, type ProfileApi } from "../index";
import type { ProfileNotify } from "../types";

let host: FakeHost;
let api: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
// Typed: Vitest 5's untyped vi.fn() is "any function or class", which no callback prop accepts.
let notify: Mock<ProfileNotify>;
let look: Look;

function show(subscriptions?: React.ReactNode) {
  render(
    <SidebarProvider
      look={look}
      profile={
        <ProfilePanel
          api={api as unknown as ProfileApi}
          notify={notify}
          subscriptions={subscriptions}
        />
      }
    >
      <ViewerBadge />
    </SidebarProvider>,
  );
}

const panel = () => screen.queryByRole("region", { name: "My Profile" });
const badge = () => screen.findByRole("button", { name: `${SCOPED.user.name}, My Profile` });

async function openPanel() {
  await userEvent.click(await badge());
  return within(panel()!);
}

describe.each<Look>(["v2", "classic"])("ProfilePanel (%s)", (each) => {
  beforeEach(() => {
    look = each;
    host = installFakeHost();
    host.setToken("t1");
    host.setEntity("e-company-a", "Company A Limited");
    window.history.replaceState({}, "", "/entity/abcd/acme/petty-cash");
    _setViewerLoaderForTests(() =>
      Promise.resolve({ name: SCOPED.user.name, initials: SCOPED.user.initials }),
    );
    api = { load: vi.fn<(id?: string) => Promise<Profile>>(), save: vi.fn() };
    notify = vi.fn();
  });

  it("opens from the badge over the page, and reads the profile only then, for the cookie's company", async () => {
    api.load.mockResolvedValue(SCOPED);
    show(<p>The overview card</p>);
    await badge();
    expect(api.load).not.toHaveBeenCalled();

    const view = await openPanel();
    expect(
      await view.findByRole("heading", { level: 2, name: SCOPED.user.name }),
    ).toBeInTheDocument();
    expect(api.load).toHaveBeenCalledWith("e-company-a", expect.any(AbortSignal));
    expect(view.getByText("Company A Limited")).toBeInTheDocument();
    expect(view.getByText("Shop Manager")).toBeInTheDocument();
    expect(view.getByRole("region", { name: "Your details" })).toBeInTheDocument();
    expect(view.getByText(SCOPED.user.email)).toBeInTheDocument();
    expect(view.getByText("The overview card")).toBeInTheDocument();
    // no password row: Minty holds no password (the owner, 2026-10-20)
    expect(view.queryByText(/password/i)).toBeNull();
    // over the page: nothing navigated
    expect(window.location.pathname).toBe("/entity/abcd/acme/petty-cash");
  });

  it("saves only what changed, tells the badge the new name, and says so", async () => {
    api.load.mockResolvedValue(UNSCOPED);
    const renamed: Profile = {
      ...UNSCOPED,
      user: { ...UNSCOPED.user, first_name: "Jon", name: "Jon Birmingha", initials: "JB" },
    };
    api.save.mockResolvedValue(renamed);
    show();
    const view = await openPanel();
    await userEvent.click(await view.findByRole("button", { name: "Edit" }));
    const first = view.getByRole("textbox", { name: "FIRST NAME" });
    await userEvent.clear(first);
    await userEvent.type(first, "Jon");
    await userEvent.click(view.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith({ first_name: "Jon" }, "e-company-a"),
    );
    expect(
      await view.findByRole("heading", { level: 2, name: "Jon Birmingha" }),
    ).toBeInTheDocument();
    expect(notify).toHaveBeenCalledWith("Your profile is saved.", "success");
    expect(view.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("shows a refusal in the card, in the server's words, and keeps what was typed", async () => {
    api.load.mockResolvedValue(UNSCOPED);
    api.save.mockRejectedValue({ status: 422, message: "That email is already in use." });
    show();
    const view = await openPanel();
    await userEvent.click(await view.findByRole("button", { name: "Edit" }));
    const email = view.getByRole("textbox", { name: "Email" });
    await userEvent.clear(email);
    await userEvent.type(email, "taken@x.com");
    await userEvent.click(view.getByRole("button", { name: "Save" }));

    expect(await view.findByRole("alert")).toHaveTextContent("That email is already in use.");
    expect(view.getByRole("textbox", { name: "Email" })).toHaveValue("taken@x.com");
    expect(notify).not.toHaveBeenCalled();
  });

  it("a failed read offers to try again; a 401 shows nothing (the app is already re-signing in)", async () => {
    api.load
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(UNSCOPED);
    show();
    const view = await openPanel();
    expect(
      await view.findByText("Your profile didn't come through. Mind trying again?"),
    ).toBeInTheDocument();
    await userEvent.click(view.getByRole("button", { name: "Try again" }));
    expect(
      await view.findByRole("heading", { level: 2, name: UNSCOPED.user.name }),
    ).toBeInTheDocument();
  });

  it("Log Out is the host's; ‹ goes back to the menu and the close shuts the sidebar", async () => {
    api.load.mockResolvedValue(UNSCOPED);
    show();
    let view = await openPanel();
    await userEvent.click(await view.findByRole("button", { name: "Log Out" }));
    expect(host.logOut).toHaveBeenCalled();

    await userEvent.click(view.getByRole("button", { name: "Back to the menu" }));
    expect(panel()).toBeNull();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close menu" }));
    view = await openPanel();
    await userEvent.click(view.getByRole("button", { name: "Close My Profile" }));
    expect(panel()).toBeNull();
  });

  it("names every file it draws from the app's public/ (the asset contract)", () => {
    expect([...PROFILE_ASSETS].sort()).toEqual(
      [
        "/profile/back.svg",
        "/profile/logout.svg",
        "/profile/mail.svg",
        "/profile/person.svg",
        "/profile/super-minty.png",
      ].sort(),
    );
  });
});
