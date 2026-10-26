/**
 * How every app shows and types an amount (owner, 2026-10-21: one rule everywhere).
 *
 * Display: the ISO currency code, a NON-BREAKING space (U+00A0, so a line never splits the code
 * from its amount), then the number grouped in threes with exactly the currency's decimal places -
 * "HKD 12,000.00", "JPY 1,200". Never a symbol ("$", "HK$"), never a "$" when there is no currency:
 * the number stands alone here, and an app whose company can lack a currency says so itself
 * (Petty Cash: "No currency selected"). One exception: a PRICE on the onboarding and subscription
 * screens drops a trailing ".00" ("HKD 400") - formatPrice.
 *
 * Entry (owner, 2026-10-26): the commas appear as the person types - formatAmountTyping, with the
 * caret kept on the same digit - and blur only pads the places (formatAmount: "1,234.5" ->
 * "1,234.50"). Typing is capped at MAX_AMOUNT_INT_DIGITS digits before the point and the
 * currency's places after it (no point at all for 0); a keystroke past that is refused, never
 * truncated, so the caret never jumps. Counts (formatCountTyping) group the same way, with no
 * point. The React side is useAmountInput in ./amountInput.
 *
 * Grouping and rounding are string work rather than parseFloat/toLocaleString, so a 12-digit
 * amount keeps every digit; extra decimals are cut off, not rounded ("9.999" -> "9.99").
 *
 * Merged from minty-onboarding-web's lib/amount.ts (the decimal places) and
 * minty-payment-request-web's lib/amountFormat.ts (formatMoney, parseAmount, the limits).
 */

/** Between the code and the amount: a non-breaking space (owner, 2026-10-21). */
export const CODE_SPACE = "\u00a0";

/** Max digits allowed before the decimal point. */
export const MAX_AMOUNT_INT_DIGITS = 11;

/** Decimal places when the caller does not pass the currency's own (`currency_info.decimal_places`). */
export const MAX_AMOUNT_DECIMALS = 2;

/** Strip grouping commas so only digits, a sign and at most one point remain. */
export function cleanAmountString(raw: string | number): string {
  return String(raw).trim().replace(/,/g, "");
}

/** Number of digits before the decimal point in a comma-free amount string. */
export function amountIntegerDigits(cleaned: string): number {
  return (cleaned.split(".")[0] ?? "").length;
}

/** Insert a comma every 3 digits, right to left. "12345" -> "12,345". */
function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Normalize an amount to an exact decimal string in `decimals` places, e.g. "12,312,312.5" ->
 * "12312312.50". Extra decimals are truncated ("9.999" -> "9.99"); with 0 places there is no
 * point ("1200.5" -> "1200"). Undefined when blank or not a number.
 */
export function toAmountString(
  raw: string | number,
  decimals: number = MAX_AMOUNT_DECIMALS,
): string | undefined {
  const cleaned = cleanAmountString(raw);
  if (!cleaned || cleaned === ".") return undefined;

  const negative = cleaned.startsWith("-");
  const unsigned = negative ? cleaned.slice(1) : cleaned;
  if (!/^\d*\.?\d*$/.test(unsigned) || !/\d/.test(unsigned)) return undefined;

  const [intRaw = "", decRaw = ""] = unsigned.split(".");
  let intPart = intRaw.replace(/^0+(?=\d)/, "");
  if (intPart === "") intPart = "0";

  const dec = (decRaw + "0".repeat(decimals)).slice(0, decimals);

  const sign = negative && /[1-9]/.test(intPart + dec) ? "-" : "";
  return decimals > 0 ? `${sign}${intPart}.${dec}` : `${sign}${intPart}`;
}

/**
 * A number as a plain decimal string - no exponent, no grouping - so it can go through the
 * string formatters. Rendered at 15 significant digits first: a float sum like 0.1 + 0.2 is
 * 0.30000000000000004 and 3.00 - 1.00 can land on 1.9999999999999998, so truncating the raw float
 * would show 1.99; at 15 digits that noise collapses (2.00000000000000), which then truncates
 * cleanly. 15 rather than a fixed 8 decimals: an 11-digit amount such as 12345678901.99 is
 * 12345678901.98999977 at 8dp and would lose a cent. Outside toPrecision's plain range (tiny or
 * huge values, written with an exponent) toFixed is used.
 */
function numberToPlainString(n: number): string {
  if (!Number.isFinite(n)) return "";
  const p = n.toPrecision(15);
  return /e/i.test(p) ? n.toFixed(8) : p;
}

/**
 * Any amount for display: grouped in threes, always `decimals` places. Takes a typed string, an
 * API decimal string or a number. "" when there is no usable number.
 */
export function formatAmount(
  value: string | number | null | undefined,
  decimals: number = MAX_AMOUNT_DECIMALS,
): string {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "number" ? numberToPlainString(value) : value;
  const normalized = toAmountString(raw, decimals);
  if (normalized === undefined) return "";
  const [intPart = "", dec] = normalized.split(".");
  const negative = intPart.startsWith("-");
  const digits = negative ? intPart.slice(1) : intPart;
  return `${negative ? "-" : ""}${groupThousands(digits)}${dec !== undefined ? `.${dec}` : ""}`;
}

/**
 * An amount with its currency: "HKD 12,000.00", "-HKD 120.00" (the sign leads), "JPY 1,200" with
 * `decimals` 0 - the space is CODE_SPACE (non-breaking). The code is trimmed and upper-cased; with
 * no code the number stands alone. "" when there is no usable number.
 */
export function formatMoney(
  value: string | number | null | undefined,
  currencyCode: string | null | undefined,
  decimals: number = MAX_AMOUNT_DECIMALS,
): string {
  const amount = formatAmount(value, decimals);
  if (!amount) return "";
  const code = (currencyCode ?? "").trim().toUpperCase();
  if (!code) return amount;
  return amount.startsWith("-")
    ? `-${code}${CODE_SPACE}${amount.slice(1)}`
    : `${code}${CODE_SPACE}${amount}`;
}

/**
 * A price on the onboarding and subscription screens: formatMoney, less a trailing ".00" -
 * "HKD 400", but "HKD 400.50" keeps its cents (owner, 2026-10-21). The subscription API's
 * `format_price` is the same rule. Invoices, the invoice list and billed amounts use
 * formatMoney and keep the places.
 */
export function formatPrice(
  value: string | number | null | undefined,
  currencyCode: string | null | undefined,
  decimals: number = MAX_AMOUNT_DECIMALS,
): string {
  const text = formatMoney(value, currencyCode, decimals);
  const zeros = `.${"0".repeat(decimals)}`;
  return decimals > 0 && text.endsWith(zeros) ? text.slice(0, -zeros.length) : text;
}

/** True when a typed amount is within the digit limits (the sign does not count). */
export function isWithinAmountLimits(raw: string, decimals: number = MAX_AMOUNT_DECIMALS): boolean {
  const [intPart = "", dec = ""] = cleanAmountString(raw).replace(/^-/, "").split(".");
  return intPart.length <= MAX_AMOUNT_INT_DIGITS && dec.length <= decimals;
}

/**
 * A displayed or typed amount back as a number ("12,000.00" -> 12000). Null when blank or not a
 * number - never a silent 0: a caller that wants 0 for an empty field says so (`?? 0`).
 */
export function parseAmount(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = cleanAmountString(raw);
  if (!cleaned || cleaned === ".") return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Gate a keystroke in an amount field: the value to store, or null to refuse the edit and leave
 * the field as it was. The value stays plain digits while typing (formatAmount on blur adds the
 * commas). Amounts are typed unsigned.
 */
export function acceptAmountInput(
  next: string,
  decimals: number = MAX_AMOUNT_DECIMALS,
): string | null {
  const cleaned = cleanAmountString(next);
  if (cleaned === "") return "";
  if (!/^\d*\.?\d*$/.test(cleaned)) return null;
  if (decimals === 0 && cleaned.includes(".")) return null;
  const [intPart = "", dec = ""] = cleaned.split(".");
  if (intPart.length > MAX_AMOUNT_INT_DIGITS) return null;
  if (dec.length > decimals) return null;
  return cleaned;
}

/** Strip grouping so a formatted amount can be edited as plain digits on focus. */
export function toAmountEditString(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return "";
  return cleanAmountString(raw);
}

/** One edit in a number field, as the change event reports it. */
export type TypingEdit = {
  /** The field's value after the edit (`input.value`). */
  text: string;
  /** Where the caret sits in `text` (`input.selectionStart`). */
  caret: number;
  /** The value before the edit - lets a delete over a comma take the digit beside it. */
  previous?: string;
  /** `InputEvent.inputType` ("deleteContentBackward", "insertFromPaste"...). */
  inputType?: string;
};

/** The formatted value and where to put the caret; null refuses the edit. */
export type TypingResult = { text: string; caret: number } | null;

const isNumberChar = (ch: string) => (ch >= "0" && ch <= "9") || ch === ".";

/**
 * Shared by the amount and count typers: strip the grouping, check the edit with `accept`, drop
 * leading zeros, regroup, and put the caret back after the same number of digits it followed.
 */
function formatTyping(edit: TypingEdit, accept: (plain: string) => string | null): TypingResult {
  let { text, caret } = edit;
  const { previous, inputType } = edit;

  // A paste or drop brings its own decoration ("HKD 1,234.50"); keep only the number in it.
  if (inputType === "insertFromPaste" || inputType === "insertFromDrop") {
    const head = text.slice(0, caret).replace(/[^\d.,]/g, "");
    text = head + text.slice(caret).replace(/[^\d.,]/g, "");
    caret = head.length;
  }

  // Backspace or Delete took only a comma: take the digit beside it instead, or nothing changes.
  if (previous !== undefined && text.length === previous.length - 1) {
    if (inputType === "deleteContentBackward" && previous[caret] === ",") {
      if (caret === 0) return null;
      text = text.slice(0, caret - 1) + text.slice(caret);
      caret -= 1;
    } else if (inputType === "deleteContentForward" && previous[caret] === ",") {
      text = text.slice(0, caret) + text.slice(caret + 1);
    }
  }

  let digitsBefore = [...text.slice(0, caret)].filter(isNumberChar).length;
  const plain = accept(text);
  if (plain === null) return null;

  const [intRaw = "", dec] = plain.split(".");
  // "0012" -> "12" and "05" -> "5", but a lone "0" stays, and ".5" reads "0.5".
  const zeros = intRaw.length - intRaw.replace(/^0+/, "").length;
  const keep = intRaw.length > 0 && intRaw.length === zeros && dec === undefined ? 1 : 0;
  let intPart = intRaw.slice(zeros - keep);
  digitsBefore -= Math.min(digitsBefore, zeros - keep);
  if (intPart === "" && dec !== undefined) {
    intPart = "0";
    digitsBefore += 1;
  }

  const out = `${groupThousands(intPart)}${dec !== undefined ? `.${dec}` : ""}`;
  let pos = 0;
  for (let seen = 0; pos < out.length && seen < digitsBefore; pos += 1) {
    if (isNumberChar(out[pos]!)) seen += 1;
  }
  return { text: out, caret: pos };
}

/**
 * An amount as it is typed: grouped in threes at every keystroke ("1234567.5" ->
 * "1,234,567.5"), the caret kept beside the digit it followed. The limits are acceptAmountInput's:
 * a 12th whole digit, a third place, a second point, a letter or a minus refuses the edit (null),
 * so the caller leaves the field as it was. Blur pads the places with formatAmount.
 */
export function formatAmountTyping(
  edit: TypingEdit,
  decimals: number = MAX_AMOUNT_DECIMALS,
): TypingResult {
  return formatTyping(edit, (text) => acceptAmountInput(text, decimals));
}

/**
 * A whole-number count as it is typed ("1000000" -> "1,000,000"): digits only, at most
 * `maxDigits` of them; anything else refuses the edit (null).
 */
export function formatCountTyping(edit: TypingEdit, maxDigits: number): TypingResult {
  return formatTyping(edit, (text) => {
    const cleaned = cleanAmountString(text);
    return /^\d*$/.test(cleaned) && cleaned.length <= maxDigits ? cleaned : null;
  });
}
