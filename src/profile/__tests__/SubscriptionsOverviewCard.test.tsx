// My Profile's "Subscriptions Overview" (Figma 10-A / 10-B), packaged: the two figures from the
// person's subscriptions, Manage Subscription into minty-web's portal (the host's link), the
// quiet state, and a read that fails. The figures' rule is minty-web's `overview` (08-A).

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { installFakeHost } from "../../../test/fakeHost";
import {
  SubscriptionsOverviewCard,
  daysFromToday,
  overviewFigures,
  type SubscriptionsList,
} from "../index";

const TODAY = new Date("2026-10-20T03:00:00Z"); // 11:00 in Hong Kong

const company = (...modules: { status: string; date_iso: string | null }[]) => ({ modules });

const LIST: SubscriptionsList = {
  entities: [
    company(
      { status: "active", date_iso: "2026-11-20" },
      { status: "trialing", date_iso: "2026-10-25" },
    ),
    company({ status: "cancelled", date_iso: "2026-11-01" }),
    company({ status: "trialing", date_iso: "2026-11-19" }), // 30 days: still ending
    company({ status: "trialing", date_iso: "2026-11-20" }), // 31 days: not yet
    company({ status: "expired", date_iso: "2026-09-01" }),
  ],
};

describe("the overview's figures (minty-web's rule)", () => {
  it("counts COMPANIES: active or cancelled is active; a trial within 30 days is ending", () => {
    expect(overviewFigures(LIST, TODAY)).toEqual({ active: 2, trialEnding: 2 });
    expect(overviewFigures({ entities: [] }, TODAY)).toEqual({ active: 0, trialEnding: 0 });
  });

  it("reckons today in Hong Kong, as calendar days", () => {
    expect(daysFromToday("2026-10-21", new Date("2026-10-19T17:00:00Z"))).toBe(1); // 01:00 HKT on the 20th
    expect(daysFromToday("2026-10-21T23:59:00+08:00", TODAY)).toBe(1);
    expect(daysFromToday("2026-10-19", TODAY)).toBe(-1);
    expect(daysFromToday(null, TODAY)).toBeNull();
    expect(daysFromToday("soon", TODAY)).toBeNull();
  });
});

describe("SubscriptionsOverviewCard", () => {
  let load: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    installFakeHost({
      links: {
        entities: () => "/entities",
        subscriptions: () => "https://accounts.test/handoff/minty-web?next=%2Fsubscription",
        pettyCashDashboard: () => "/",
        pettyCashReports: () => "/",
        bills: () => "/",
        settings: () => "/",
        profile: () => "/profile",
      },
    });
    load = vi.fn();
  });

  it("draws the two figures and Manage Subscription into the portal", async () => {
    load.mockResolvedValue(LIST);
    render(<SubscriptionsOverviewCard load={load} today={TODAY} />);
    const card = await screen.findByRole("region", { name: "Subscriptions Overview" });
    expect(card).toHaveTextContent("Active subscriptions2entities");
    expect(card).toHaveTextContent("Trial ending2entities");
    expect(screen.getByRole("link", { name: "Manage Subscription" })).toHaveAttribute(
      "href",
      "https://accounts.test/handoff/minty-web?next=%2Fsubscription",
    );
    expect(load).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("paying for nothing: the quiet line, and no button", async () => {
    load.mockResolvedValue({ entities: [] });
    render(<SubscriptionsOverviewCard load={load} today={TODAY} />);
    expect(
      await screen.findByText("It looks a little quiet here. No entity subscriptions yet."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manage Subscription" })).toBeNull();
  });

  it("a failed read says so, with Try again; a 401 says nothing", async () => {
    load
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ entities: [] });
    render(<SubscriptionsOverviewCard load={load} today={TODAY} />);
    expect(
      await screen.findByText("Your subscriptions didn't load. Mind trying again?"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/No entity subscriptions yet/)).toBeInTheDocument();
  });

  it("a 401 shows no error (the app is already re-signing in)", async () => {
    load.mockRejectedValue({ status: 401, message: "Your session has ended." });
    render(<SubscriptionsOverviewCard load={load} today={TODAY} />);
    await screen.findByRole("region", { name: "Subscriptions Overview" });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
