// "Back" goes to the page the person came from (lib/backLink.tsx): past the entries the caller
// skips and the one-time hand-off pages, out to another app only when the caller allows it, and
// to the fallback when there is nothing to go back to. Moved from minty-web (v0.20).

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BackLink, goBack, isSkipped, stepsBack } from "../backLink";

const ORIGIN = "https://hub.minty.test";
const SETTINGS = /^\/entity\/[^/]+\/[^/]+\/settings(\/|$)/;
const MODULES = `${ORIGIN}/entity/e1/olive-shop/settings/modules`;
const USERS = `${ORIGIN}/entity/e1/olive-shop/settings/users`;
const WIZARD = /\/petty-cash\/reports\/new\//;
const PC = `${ORIGIN}/entity/e1/olive-shop/petty-cash`;

/** A tab's history as the Navigation API reports it: only THIS origin's run of entries, each
 * `index` its place in that run (not in the whole tab), the current one last. */
function nav(urls: string[]) {
  const entries = urls.map((url, index) => ({ index, url }));
  return { currentEntry: entries[entries.length - 1] ?? null, entries: () => entries };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "navigation");
});

describe("isSkipped", () => {
  it("skips what the caller names and every hand-off page, on this origin only", () => {
    expect(isSkipped(MODULES, ORIGIN, [SETTINGS])).toBe(true);
    expect(isSkipped(`${USERS}?fixture=a`, ORIGIN, [SETTINGS])).toBe(true);
    expect(isSkipped(`${ORIGIN}/entities`, ORIGIN, [SETTINGS])).toBe(false);
    expect(isSkipped(`${ORIGIN}/landing?code=x`, ORIGIN, [])).toBe(true);
    expect(isSkipped(`${ORIGIN}/handoff/petty-cash-web?x=1`, ORIGIN, [])).toBe(true);
    expect(isSkipped(`${ORIGIN}/enter?next=/`, ORIGIN, [])).toBe(true);
    expect(isSkipped("https://elsewhere.test/entity/e1/o/settings/users", ORIGIN, [SETTINGS])).toBe(
      false,
    );
    expect(isSkipped(null, ORIGIN, [SETTINGS])).toBe(false);
  });
});

describe("stepsBack", () => {
  it("goes back to the last page not skipped, past reloads of this one", () => {
    // /entities -> modules -> users -> modules (now), all in this tab
    const n = nav([`${ORIGIN}/entities`, MODULES, USERS, MODULES]);
    expect(stepsBack(n, ORIGIN, 4, { skip: [SETTINGS] })).toBe(3);
  });

  it("goes back one page when nothing is skipped (the report list with its filters)", () => {
    const n = nav([
      `${PC}/reports?start_date=2026-10-01&end_date=2026-10-13&page=2`,
      `${PC}/reports/r1/summary`,
    ]);
    expect(stepsBack(n, ORIGIN, 2)).toBe(1);
  });

  it("goes back past the wizard's steps to where it was entered", () => {
    const n = nav([PC, `${PC}/reports`, `${PC}/reports/new/opening`, `${PC}/reports/new/sale`]);
    expect(stepsBack(n, ORIGIN, 4, { skip: [WIZARD] })).toBe(2);
  });

  it("leaves the app only when allowed, when the person came from another one", () => {
    // [Flask, Payments] -> modules -> users (now): the tab holds 4 entries, this run 2
    const n = nav([MODULES, USERS]);
    expect(stepsBack(n, ORIGIN, 4, { skip: [SETTINGS], leaveApp: true })).toBe(2);
    expect(stepsBack(n, ORIGIN, 4, { skip: [SETTINGS] })).toBe(0);
  });

  it("never goes back into a used hand-off: the app's first page follows the fallback", () => {
    const n = nav([`${ORIGIN}/landing?code=used`, `${PC}/reports/r1/summary`]);
    expect(stepsBack(n, ORIGIN, 3)).toBe(0);
  });

  it("answers 0 when the tab started here (the fallback is followed)", () => {
    expect(stepsBack(nav([MODULES]), ORIGIN, 1, { leaveApp: true })).toBe(0);
    expect(stepsBack(nav([MODULES, USERS]), ORIGIN, 2, { skip: [SETTINGS], leaveApp: true })).toBe(
      0,
    );
  });

  it("is unknown without the Navigation API", () => {
    expect(stepsBack(undefined, ORIGIN, 3)).toBeNull();
  });
});

describe("goBack", () => {
  function spies() {
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, origin: ORIGIN, assign });
    return { go, back, assign };
  }

  it("steps back through history when there is a page to go back to", () => {
    const { go, assign } = spies();
    Object.defineProperty(window, "navigation", {
      configurable: true,
      value: nav([`${PC}/reports?page=2`, `${PC}/reports/r1/summary`]),
    });
    goBack(PC);
    expect(go).toHaveBeenCalledWith(-1);
    expect(assign).not.toHaveBeenCalled();
  });

  it("follows the fallback when there is none", () => {
    const { go, assign } = spies();
    Object.defineProperty(window, "navigation", {
      configurable: true,
      value: nav([`${PC}/reports/r1/summary`]),
    });
    goBack(PC);
    expect(go).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith(PC);
  });

  it("without the Navigation API: history.back() only when it may leave the app", () => {
    const { back, assign } = spies();
    vi.spyOn(window.history, "length", "get").mockReturnValue(3);
    goBack(PC);
    expect(assign).toHaveBeenCalledWith(PC);
    goBack(PC, { leaveApp: true });
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe("BackLink", () => {
  it("is a real link to the fallback whose plain click goes back", () => {
    const { assign } = (() => {
      const assign = vi.fn();
      vi.stubGlobal("location", { ...window.location, origin: ORIGIN, assign });
      return { assign };
    })();
    render(
      <BackLink href={PC} ariaLabel="Back">
        ‹
      </BackLink>,
    );
    const link = screen.getByRole("link", { name: "Back" });
    expect(link.getAttribute("href")).toBe(PC);
    expect(link.hasAttribute("data-back-link")).toBe(true);
    fireEvent.click(link);
    expect(assign).toHaveBeenCalledWith(PC); // no history here: the fallback
    assign.mockClear();
    fireEvent.click(link, { ctrlKey: true }); // a new tab: the browser opens href itself
    expect(assign).not.toHaveBeenCalled();
  });
});
