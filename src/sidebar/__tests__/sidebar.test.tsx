// What the PACKAGE owns: the drawer's mechanics, and that every per-app answer is taken from the
// host and nowhere else. Each app's own wiring - which header mounts the openers, which routes
// exist, what its cookie holds - stays tested in that app (minty-web's and
// minty-payment-request-web's `components/ui/__tests__/Sidebar.test.tsx`, which diverged on
// purpose).

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { installFakeHost, type FakeHost } from "../../../test/fakeHost";
import { _resetSidebarHostForTests, requireSidebarHost, setSidebarHost } from "../../host";
import { NavMenu } from "../NavMenu";
import { SidebarProvider } from "../Sidebar";

// The fake host's usePathname reads window.location, as a real app's router would reflect it.
// No `vi.mock("next/navigation")` anywhere here: the package does not import it (see host.ts).
function at(path: string) {
  window.history.replaceState({}, "", path);
}

function app() {
  return (
    <SidebarProvider profile={<p>the profile slot</p>}>
      <NavMenu />
    </SidebarProvider>
  );
}

const menu = () => screen.queryByRole("navigation", { name: "Main navigation" });
const open = () => userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
const item = (name: string) => screen.getByRole("link", { name });

let host: FakeHost;

describe("the packaged sidebar", () => {
  beforeEach(() => {
    host = installFakeHost();
    at("/entities");
  });

  it("will not render without a host, and says which file is missing", () => {
    _resetSidebarHostForTests();
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    // Two matches rather than one with the `s` flag: the target is ES2017, as in every app.
    expect(() => render(app())).toThrow(/no sidebar host/);
    expect(() => render(app())).toThrow(/sidebarHost/);
    quiet.mockRestore();
  });

  it("refuses another APP's host rather than letting one quietly win", () => {
    expect(() => setSidebarHost({ ...host, app: "some-other-app" })).toThrow(/one page, one app/);
  });

  it("lets the same app re-register, because that is what a dev reload does", () => {
    // Next evaluates a host module once per bundler layer and again on every HMR edit, each time
    // building a fresh object literal. Keying this guard on identity threw on an ordinary reload.
    expect(() => setSidebarHost({ ...host, entityId: () => "after-hmr" })).not.toThrow();
    expect(requireSidebarHost().entityId()).toBe("after-hmr");
  });

  it("takes every destination from the host", async () => {
    host.setEntity("e1", "Acme");
    host.setCurrent("settings");
    at("/entity/abcd1234/acme/settings/modules");
    render(app());
    await open();

    expect(item("Select Entity")).toHaveAttribute("href", "/entities");
    expect(item("Manage subscriptions")).toHaveAttribute("href", "/subscription");
    expect(item("Dashboard")).toHaveAttribute("href", "https://minty.test/entity/e1/enter");
    expect(item("Reports")).toHaveAttribute(
      "href",
      "https://minty.test/entity/e1/petty-cash/reports",
    );
    expect(item("Bills")).toHaveAttribute("href", "https://bills.test/");
    expect(item("Settings")).toHaveAttribute("href", "/entity/abcd1234/acme/settings/modules");
  });

  it("marks the page being shown for assistive technology only", async () => {
    host.setCurrent("entities");
    render(app());
    await open();
    expect(item("Select Entity")).toHaveAttribute("aria-current", "page");
    expect(item("Manage subscriptions")).not.toHaveAttribute("aria-current");
  });

  it("draws a company's module sections only inside a company, and only the modules it has", async () => {
    host.setEntity("e1", "Acme");
    host.setCurrent(null);
    host.setModules({ pettyCash: true, billing: false });
    at("/entity/abcd1234/acme");
    render(app());
    await open();

    expect(screen.getByRole("group", { name: "Petty Cash" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Payment Request" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("draws no module sections and no Settings on the entity list", async () => {
    host.setEntity("e1", "Acme");
    host.setCurrent("entities");
    render(app());
    await open();

    expect(screen.queryByRole("group", { name: "Petty Cash" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Payment Request" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("hands Logout to the host and closes only once it says the person is going", async () => {
    const logOut = vi.fn();
    host = installFakeHost({ logOut });
    render(app());
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Logout" }));

    expect(logOut).toHaveBeenCalledTimes(1);
    // The drawer is still open: the host has not called back, which is what "Go Back" on an
    // unsaved form looks like. A menu that closed first would leave them on the page, menu gone.
    expect(menu()).toBeInTheDocument();

    const onLeaving = logOut.mock.calls[0][0] as () => void;
    onLeaving();
    await waitFor(() => expect(menu()).not.toBeInTheDocument());
  });

  it("holds the page still through the host, and lets go on closing", async () => {
    render(app());
    await open();
    expect(host.released()).toBe(0);

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(host.released()).toBe(1));
  });

  it("switches to My Profile from the menu", async () => {
    host.setCurrent(null);
    render(app());
    await open();
    await userEvent.click(screen.getByRole("button", { name: "My Profile" }));

    expect(screen.getByText("the profile slot")).toBeInTheDocument();
    expect(menu()).not.toBeInTheDocument();
  });

  it("just closes on the profile page itself, instead of opening it over itself", async () => {
    host.setCurrent("profile");
    at("/profile");
    render(app());
    await open();
    await userEvent.click(screen.getByRole("button", { name: "My Profile" }));

    await waitFor(() => expect(menu()).not.toBeInTheDocument());
    expect(screen.queryByText("the profile slot")).not.toBeInTheDocument();
  });
});
