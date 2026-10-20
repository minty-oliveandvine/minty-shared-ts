/**
 * The overview's figures, pure - minty-web's `features/subscription/lib/billing.ts::overview`
 * (the figures only; 08-A's update lines stay the portal's) and its `lib/calendarDays.ts`, lifted
 * here so the profile in every app counts as the portal does. Change the two together.
 */

/** What the card reads: the person's companies and each one's modules, from subscription-api's
 *  `GET /api/me/subscriptions` (every page). Only these fields are looked at. */
export type SubscriptionsList = {
  entities: { modules: { status: string; date_iso: string | null }[] }[];
};

export type OverviewFigures = { active: number; trialEnding: number };

/**
 * How far off a trial's end may be and still count as "Trial ending": thirty days, a trial's
 * whole length (the user's call, 2026-09-25) - minty-web's `TRIAL_ENDING_DAYS`.
 */
export const TRIAL_ENDING_DAYS = 30;

/** The zone the business's days are reckoned in. */
const BUSINESS_TIME_ZONE = "Asia/Hong_Kong";

/** The calendar date an instant falls on in Hong Kong, as `YYYY-MM-DD`; "" for an unreadable one. */
function hkIsoDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return y && m && day ? `${y}-${m}-${day}` : "";
}

function isoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function utcMidnight(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Whole days from `today` to the day part of `until` - negative once it has passed, null when
 * `until` is not a date. Both sides are calendar days: `until`'s day part and `today`'s date in
 * Hong Kong, never instants.
 */
export function daysFromToday(until: string | null | undefined, today: Date): number | null {
  const end = isoDay(until);
  if (!end) return null;
  const from = hkIsoDate(today);
  if (!from) return null;
  return Math.round((utcMidnight(end) - utcMidnight(from)) / 86_400_000);
}

/**
 * "Active subscriptions" counts COMPANIES - once however many modules - with any module active or
 * cancelled (a trial is not active: nothing is charged yet). "Trial ending" counts the companies
 * with a trial ending within `TRIAL_ENDING_DAYS`.
 */
export function overviewFigures(list: SubscriptionsList, today: Date): OverviewFigures {
  let active = 0;
  let trialEnding = 0;
  for (const entity of list.entities) {
    if (entity.modules.some((m) => m.status === "active" || m.status === "cancelled")) active += 1;
    const ending = entity.modules.some((m) => {
      if (m.status !== "trialing") return false;
      const left = daysFromToday(m.date_iso, today);
      return left !== null && left <= TRIAL_ENDING_DAYS;
    });
    if (ending) trialEnding += 1;
  }
  return { active, trialEnding };
}

/** "entity" / "entities" - the unit under a figure. */
export function entityUnit(n: number): string {
  return n === 1 ? "entity" : "entities";
}
