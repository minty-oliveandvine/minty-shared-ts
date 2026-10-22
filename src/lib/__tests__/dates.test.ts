// Calendar days in every app (lib/dates.ts). Ported from minty-web's lib/__tests__/calendarDays.test.ts,
// minty-payment-request-web's lib/__tests__/dateDisplayFormat.test.ts, minty-petty-cash-web's
// lib/__tests__/dates.test.ts and minty-onboarding-web's lib/__tests__/date.test.ts, with one rule
// where they differed: a day is a real calendar date or nothing, and a month is three fixed letters.
// Every instant is UTC and every zone named, so the suite says the same thing in any timezone.

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  daysFromToday,
  formatDay,
  formatInstantDay,
  HK_TIME_ZONE,
  isoDateInTimeZone,
  MONTHS,
  todayIso,
} from "../dates";

describe("HK_TIME_ZONE and MONTHS", () => {
  it("reckons in Asia/Hong_Kong", () => {
    expect(HK_TIME_ZONE).toBe("Asia/Hong_Kong");
  });

  it("names every month in three fixed English letters - Sep, never Sept", () => {
    expect(MONTHS).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]);
  });
});

describe("isoDateInTimeZone", () => {
  it("rolls a UTC evening into the next Hong Kong day", () => {
    expect(isoDateInTimeZone(HK_TIME_ZONE, new Date("2026-08-31T18:00:00Z"))).toBe("2026-09-01");
    expect(isoDateInTimeZone(HK_TIME_ZONE, new Date("2026-10-19T15:59:59Z"))).toBe("2026-10-19");
    expect(isoDateInTimeZone(HK_TIME_ZONE, new Date("2026-10-19T16:00:00Z"))).toBe("2026-10-20");
  });

  it("is the UTC day when asked for UTC, and pads month and day", () => {
    expect(isoDateInTimeZone("UTC", new Date("2026-08-31T18:00:00Z"))).toBe("2026-08-31");
    expect(isoDateInTimeZone("UTC", new Date("2026-01-04T00:00:00Z"))).toBe("2026-01-04");
  });

  it("compares correctly with plain < and > against a date input", () => {
    const day = isoDateInTimeZone(HK_TIME_ZONE, new Date("2026-08-31T18:00:00Z"));
    expect(day > "2026-08-31").toBe(true);
    expect(day <= "2026-09-01").toBe(true);
  });

  it('is "" for an unreadable instant', () => {
    expect(isoDateInTimeZone(HK_TIME_ZONE, new Date("nonsense"))).toBe("");
  });

  it("throws for an unknown zone rather than guessing a day", () => {
    expect(() => isoDateInTimeZone("Mars/Olympus", new Date())).toThrow(RangeError);
  });

  it("defaults to now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T17:00:00Z"));
    expect(isoDateInTimeZone(HK_TIME_ZONE)).toBe("2026-10-20");
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

describe("todayIso", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is Hong Kong's date by default - 17:00 UTC on 19 Oct is the 20th there", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T17:00:00Z"));
    expect(todayIso()).toBe("2026-10-20");
    expect(todayIso("UTC")).toBe("2026-10-19");
  });
});

describe("daysFromToday", () => {
  const lateUtc = new Date("2026-10-19T17:00:00Z"); // 20 Oct 01:00 in Hong Kong

  it("counts from Hong Kong's day: 01:00 HK on 20 Oct is 2 days before the 22nd", () => {
    expect(daysFromToday("2026-10-22", lateUtc)).toBe(2);
    expect(daysFromToday("2026-10-20", lateUtc)).toBe(0);
    expect(daysFromToday("2026-10-19", lateUtc)).toBe(-1);
  });

  it("reads a datetime's day part, which is the business day already", () => {
    expect(daysFromToday("2026-10-21T09:00:00+08:00", lateUtc)).toBe(1);
    expect(daysFromToday("  2026-10-21  ", lateUtc)).toBe(1);
  });

  it("counts across a year end, a leap day and long spans in whole days", () => {
    const now = new Date("2026-12-31T04:00:00Z");
    expect(daysFromToday("2027-01-01", now)).toBe(1);
    expect(daysFromToday("2027-12-31", now)).toBe(365);
    expect(daysFromToday("2028-03-01", new Date("2028-02-28T04:00:00Z"))).toBe(2);
  });

  it("is null for no date, one it cannot read, or one the calendar has not got", () => {
    expect(daysFromToday(null, lateUtc)).toBeNull();
    expect(daysFromToday(undefined, lateUtc)).toBeNull();
    expect(daysFromToday("", lateUtc)).toBeNull();
    expect(daysFromToday("soon", lateUtc)).toBeNull();
    expect(daysFromToday("2026/10/20", lateUtc)).toBeNull();
    expect(daysFromToday("2026-02-30", lateUtc)).toBeNull();
    expect(daysFromToday("2026-13-01", lateUtc)).toBeNull();
  });

  it("is null for an unreadable today", () => {
    expect(daysFromToday("2026-10-22", new Date("nope"))).toBeNull();
  });
});

describe("formatDay", () => {
  it.each([
    ["2026-09-05", "05 Sep 2026"],
    ["2026-10-04", "04 Oct 2026"],
    ["2026-12-31", "31 Dec 2026"],
    ["2026-01-01", "01 Jan 2026"],
    ["2024-02-29", "29 Feb 2024"],
  ])("shows %s as %s", (iso, shown) => {
    expect(formatDay(iso)).toBe(shown);
  });

  it("names every month from MONTHS", () => {
    const names = MONTHS.map((_, i) =>
      formatDay(`2026-${String(i + 1).padStart(2, "0")}-01`).slice(3, 6),
    );
    expect(names).toEqual([...MONTHS]);
  });

  it("shows a datetime's day part, and ignores surrounding whitespace", () => {
    expect(formatDay("2026-03-03T23:59:59Z")).toBe("03 Mar 2026");
    expect(formatDay("  2026-03-03  ")).toBe("03 Mar 2026");
  });

  it.each([
    ["30 February", "2026-02-30"],
    ["29 February outside a leap year", "2025-02-29"],
    ["1900, not a leap year", "1900-02-29"],
    ["month 13", "2026-13-01"],
    ["month 0", "2026-00-10"],
    ["day 0", "2026-01-00"],
    ["unpadded parts", "2026-1-5"],
    ["a slashed date", "03/03/2026"],
    ["words", "not a date"],
    ["blank", "   "],
    ["empty", ""],
  ])('is "" for %s', (_label, raw) => {
    expect(formatDay(raw)).toBe("");
  });

  it('is "" for null and undefined', () => {
    expect(formatDay(null)).toBe("");
    expect(formatDay(undefined)).toBe("");
  });

  it("keeps a year below 100 as written, never 19xx", () => {
    expect(formatDay("0026-01-01")).toBe("01 Jan 0026");
    expect(formatDay("2000-02-29")).toBe("29 Feb 2000");
  });
});

describe("formatInstantDay", () => {
  it("shows the Hong Kong day by default, with a three-letter September", () => {
    expect(formatInstantDay(new Date("2026-08-31T18:00:00Z"))).toBe("01 Sep 2026");
    expect(formatInstantDay(new Date("2026-09-01T02:00:00Z"))).toBe("01 Sep 2026");
  });

  it("follows the zone it is given", () => {
    expect(formatInstantDay(new Date("2026-08-31T18:00:00Z"), "UTC")).toBe("31 Aug 2026");
  });

  it('is "" for an unreadable instant', () => {
    expect(formatInstantDay(new Date("nonsense"))).toBe("");
  });
});
