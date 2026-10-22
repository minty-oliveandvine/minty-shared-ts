/**
 * Calendar days, one rule in every app (the shared-code refactor, 2026-10-21).
 *
 * A day is a `YYYY-MM-DD` string - no time, no zone - and the business reckons its days in Hong
 * Kong: "today" is the date on a Hong Kong wall clock (17:00 UTC on 19 Oct is already 20 Oct
 * there), and an API timestamp becomes a day through isoDateInTimeZone, never by cutting its
 * first ten characters (2026-08-31T18:00:00Z is 1 Sep in Hong Kong).
 *
 * A day is shown "05 Sep 2026": a two-digit day, the month from MONTHS - fixed English three
 * letters, never ICU's "Sept", which breaks a column of dates and cannot be read back - and the
 * year. Anything that is not a real calendar date shows as "", never "01 undefined 2026" and
 * never 30 Feb rolled into March.
 *
 * Merged from minty-web's lib/calendarDays.ts (daysFromToday, the Hong Kong day),
 * minty-payment-request-web's lib/dateDisplayFormat.ts (isoDateInTimeZone, the calendar check),
 * minty-petty-cash-web's lib/dates.ts (formatDay) and minty-onboarding-web's lib/date.ts and its
 * inline Hong Kong "today".
 */

/** The zone the business's days are reckoned in. */
export const HK_TIME_ZONE = "Asia/Hong_Kong";

/** The months as every date shows them: fixed English, three letters ("Sep", never "Sept"). */
export const MONTHS = [
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
] as const;

/**
 * The calendar date `date` falls on in `timeZone`, as `YYYY-MM-DD` (which also compares correctly
 * with plain `<` / `>`). "" for an unreadable instant. An unknown zone throws (Intl's RangeError):
 * a wrong zone is a bug to see, not a day to guess.
 */
export function isoDateInTimeZone(timeZone: string, date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return y && m && d ? `${y}-${m}-${d}` : "";
}

/** Today in `timeZone` (Hong Kong by default), as `YYYY-MM-DD`. */
export function todayIso(timeZone: string = HK_TIME_ZONE): string {
  return isoDateInTimeZone(timeZone, new Date());
}

type Day = { y: number; m: number; d: number };

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 0;
}

/**
 * The calendar day a value starts with: surrounding whitespace ignored, then exactly
 * `YYYY-MM-DD` as its first ten characters (so a datetime's day part counts), and only a day
 * the calendar has. Null otherwise. Plain arithmetic, not `Date`, so no day rolls over and no
 * two-digit year turns into 19xx.
 */
function readDay(value: string | null | undefined): Day | null {
  if (!value) return null;
  const head = value.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(head);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

function utcMidnight({ y, m, d }: Day): number {
  // setUTCFullYear, not Date.UTC: Date.UTC reads a year below 100 as 19xx.
  const date = new Date(0);
  date.setUTCFullYear(y, m - 1, d);
  return date.getTime();
}

/**
 * Whole days from `today`'s date in Hong Kong to the day `until` starts with - negative once it
 * has passed, null when `until` is not a real calendar date or `today` is unreadable. Both sides
 * are calendar days (the API's dates are the business day already), never instants.
 */
export function daysFromToday(until: string | null | undefined, today: Date): number | null {
  const end = readDay(until);
  if (!end) return null;
  const start = readDay(isoDateInTimeZone(HK_TIME_ZONE, today));
  if (!start) return null;
  return Math.round((utcMidnight(end) - utcMidnight(start)) / 86_400_000);
}

/**
 * A day as every app shows it: "2026-09-05" -> "05 Sep 2026". A datetime shows its day part
 * (convert an instant with formatInstantDay instead when its zone matters). "" for anything that
 * is not a real calendar date.
 */
export function formatDay(iso: string | null | undefined): string {
  const day = readDay(iso);
  if (!day) return "";
  return `${String(day.d).padStart(2, "0")} ${MONTHS[day.m - 1]} ${String(day.y).padStart(4, "0")}`;
}

/**
 * The day an instant falls on in `timeZone` (Hong Kong by default), shown as formatDay shows it:
 * 2026-08-31T18:00:00Z -> "01 Sep 2026". "" for an unreadable instant.
 */
export function formatInstantDay(date: Date, timeZone: string = HK_TIME_ZONE): string {
  return formatDay(isoDateInTimeZone(timeZone, date));
}
