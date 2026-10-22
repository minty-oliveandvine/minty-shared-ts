// How every app shows and types money (lib/money.ts). Ported from minty-payment-request-web's
// lib/__tests__/amountFormat.test.ts and minty-onboarding-web's lib/__tests__/amount.test.ts, plus
// the owner's rule of 2026-10-21: "HKD 1,234.50" - the code, a space, the currency's places;
// never a symbol, never a "$", never a trimmed ".00". All string work, never parseFloat, so a
// 12-digit amount keeps every digit.

import { describe, expect, it } from "vitest";

import {
  MAX_AMOUNT_DECIMALS,
  MAX_AMOUNT_INT_DIGITS,
  acceptAmountInput,
  amountIntegerDigits,
  cleanAmountString,
  formatAmount,
  formatMoney,
  formatPrice,
  CODE_SPACE,
  isWithinAmountLimits,
  parseAmount,
  toAmountEditString,
  toAmountString,
} from "../money";

describe("the limits", () => {
  it("are 11 digits before the point and 2 after by default", () => {
    expect(MAX_AMOUNT_INT_DIGITS).toBe(11);
    expect(MAX_AMOUNT_DECIMALS).toBe(2);
  });
});

describe("cleanAmountString", () => {
  it("trims and drops the grouping commas", () => {
    expect(cleanAmountString("  1,234.50  ")).toBe("1234.50");
    expect(cleanAmountString(1234.5)).toBe("1234.5");
    expect(cleanAmountString("")).toBe("");
  });
});

describe("amountIntegerDigits", () => {
  it("counts the digits before the point", () => {
    expect(amountIntegerDigits("1234.50")).toBe(4);
    expect(amountIntegerDigits("0.50")).toBe(1);
    expect(amountIntegerDigits(".50")).toBe(0);
    expect(amountIntegerDigits("1234")).toBe(4);
  });
});

describe("toAmountString", () => {
  it("normalises to exactly two decimals by default", () => {
    expect(toAmountString("12,312,312.5")).toBe("12312312.50");
    expect(toAmountString("7")).toBe("7.00");
    expect(toAmountString(".5")).toBe("0.50");
  });

  it("truncates past the last decimal rather than rounding", () => {
    expect(toAmountString("9.999")).toBe("9.99");
    expect(toAmountString("9.991")).toBe("9.99");
  });

  it("keeps every digit of a twelve-digit amount", () => {
    expect(toAmountString("999999999999.99")).toBe("999999999999.99");
  });

  it("strips leading zeros but keeps a lone one", () => {
    expect(toAmountString("007.50")).toBe("7.50");
    expect(toAmountString("0.50")).toBe("0.50");
    expect(toAmountString("0")).toBe("0.00");
  });

  it("keeps a minus only when something is left to be negative about", () => {
    expect(toAmountString("-7.50")).toBe("-7.50");
    expect(toAmountString("-0.00")).toBe("0.00");
    expect(toAmountString("-0")).toBe("0.00");
  });

  it.each([
    ["", ""],
    ["a dot alone", "."],
    ["words", "abc"],
    ["two dots", "1.2.3"],
    ["a stray sign", "1-2"],
  ])("is undefined for %s", (_label, raw) => {
    expect(toAmountString(raw)).toBeUndefined();
  });

  it("follows the currency's places: none for 0, three for 3", () => {
    expect(toAmountString("1200", 0)).toBe("1200");
    expect(toAmountString("1200.5", 0)).toBe("1200");
    expect(toAmountString("1.5", 3)).toBe("1.500");
  });
});

describe("formatAmount", () => {
  it("groups in threes and always shows two decimals by default", () => {
    expect(formatAmount(12000)).toBe("12,000.00");
    expect(formatAmount("6000")).toBe("6,000.00");
    expect(formatAmount("1500.5")).toBe("1,500.50");
    expect(formatAmount(999)).toBe("999.00");
    expect(formatAmount("1234567890.12")).toBe("1,234,567,890.12");
  });

  it("groups a negative amount after the sign", () => {
    expect(formatAmount(-12000)).toBe("-12,000.00");
  });

  it("cuts a third decimal off instead of rounding it", () => {
    expect(formatAmount(9.999)).toBe("9.99");
    expect(formatAmount("1.005")).toBe("1.00");
  });

  it("collapses float noise instead of truncating it down", () => {
    expect(formatAmount(0.1 + 0.2)).toBe("0.30");
    expect(formatAmount(3 - 1.0000000000000002)).toBe("2.00");
  });

  it("keeps every cent of an 11-digit number (a fixed 8dp render lost one)", () => {
    expect(formatAmount(12345678901.99)).toBe("12,345,678,901.99");
    expect(formatAmount(99999999999.99)).toBe("99,999,999,999.99");
    expect(formatMoney(12345678901.99, "HKD")).toBe("HKD\u00a012,345,678,901.99");
  });

  it("still writes tiny and huge numbers plainly", () => {
    expect(formatAmount(1e-7)).toBe("0.00");
    expect(formatAmount(1e20)).toBe("100,000,000,000,000,000,000.00");
  });

  it("follows the currency's places", () => {
    expect(formatAmount("1200", 0)).toBe("1,200");
    expect(formatAmount("1234.5678", 3)).toBe("1,234.567");
  });

  it("is empty for nothing usable", () => {
    expect(formatAmount(null)).toBe("");
    expect(formatAmount(undefined)).toBe("");
    expect(formatAmount("")).toBe("");
    expect(formatAmount("abc")).toBe("");
    expect(formatAmount(Number.NaN)).toBe("");
    expect(formatAmount(Number.POSITIVE_INFINITY)).toBe("");
  });
});

describe("formatMoney", () => {
  it("writes the code, a space, then the amount with its places", () => {
    expect(formatMoney(12000, "HKD")).toBe("HKD\u00a012,000.00");
    expect(formatMoney("1500.5", "HKD")).toBe("HKD\u00a01,500.50");
    expect(formatMoney(400, "HKD")).toBe("HKD\u00a0400.00");
    expect(formatMoney(0, "HKD")).toBe("HKD\u00a00.00");
  });

  it("follows the currency's places", () => {
    expect(formatMoney(1200, "JPY", 0)).toBe("JPY\u00a01,200");
    expect(formatMoney("1.5", "KWD", 3)).toBe("KWD\u00a01.500");
  });

  it("trims and upper-cases the code", () => {
    expect(formatMoney(5, " hkd ")).toBe("HKD\u00a05.00");
  });

  it("leads with the sign on a negative amount", () => {
    expect(formatMoney(-120, "HKD")).toBe("-HKD\u00a0120.00");
    expect(formatMoney("-0.00", "HKD")).toBe("HKD\u00a00.00");
  });

  it("writes the number alone when there is no code - never a $", () => {
    expect(formatMoney(12000, "")).toBe("12,000.00");
    expect(formatMoney(12000, "   ")).toBe("12,000.00");
    expect(formatMoney(12000, null)).toBe("12,000.00");
    expect(formatMoney(12000, undefined)).toBe("12,000.00");
  });

  it("is empty when the amount is not usable, code or not", () => {
    expect(formatMoney(null, "HKD")).toBe("");
    expect(formatMoney("abc", "HKD")).toBe("");
    expect(formatMoney(Number.NaN, "HKD")).toBe("");
  });
});

describe("CODE_SPACE", () => {
  it("is a non-breaking space, so a line never splits the code from its amount", () => {
    expect(CODE_SPACE).toBe("\u00a0");
    expect(formatMoney(400, "HKD")).not.toContain(" ");
  });
});

describe("formatPrice", () => {
  it("drops only a trailing .00 - a price with cents keeps them", () => {
    expect(formatPrice(400, "HKD")).toBe("HKD\u00a0400");
    expect(formatPrice("400.00", "HKD")).toBe("HKD\u00a0400");
    expect(formatPrice(400.5, "HKD")).toBe("HKD\u00a0400.50");
    expect(formatPrice(1500, "HKD")).toBe("HKD\u00a01,500");
    expect(formatPrice(9.999, "HKD")).toBe("HKD\u00a09.99");
    expect(formatPrice(0, "HKD")).toBe("HKD\u00a00");
  });

  it("follows the currency's places", () => {
    expect(formatPrice(1200, "JPY", 0)).toBe("JPY\u00a01,200");
    expect(formatPrice("1.5", "KWD", 3)).toBe("KWD\u00a01.500");
    expect(formatPrice("2", "KWD", 3)).toBe("KWD\u00a02");
  });

  it("keeps the sign and works with no code", () => {
    expect(formatPrice(-120, "HKD")).toBe("-HKD\u00a0120");
    expect(formatPrice(280, null)).toBe("280");
    expect(formatPrice(null, "HKD")).toBe("");
  });
});

describe("isWithinAmountLimits", () => {
  it("allows exactly eleven integer digits and two decimals", () => {
    expect(isWithinAmountLimits("12345678901.99")).toBe(true);
    expect(isWithinAmountLimits("123,456,789,01.99")).toBe(true);
  });

  it("refuses a twelfth integer digit or a third decimal", () => {
    expect(isWithinAmountLimits("123456789012")).toBe(false);
    expect(isWithinAmountLimits("1.234")).toBe(false);
  });

  it("does not count the minus sign", () => {
    expect(isWithinAmountLimits("-12345678901.99")).toBe(true);
  });

  it("follows the currency's places", () => {
    expect(isWithinAmountLimits("1.5", 0)).toBe(false);
    expect(isWithinAmountLimits("1.234", 3)).toBe(true);
  });
});

describe("parseAmount", () => {
  it("reads a displayed amount back as a number", () => {
    expect(parseAmount("12,000.00")).toBe(12000);
    expect(parseAmount("0.50")).toBe(0.5);
    expect(parseAmount("-7")).toBe(-7);
  });

  it("is null for nothing usable - never a silent 0", () => {
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("  ")).toBeNull();
    expect(parseAmount(".")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("acceptAmountInput", () => {
  it("keeps the value as plain digits while typing", () => {
    expect(acceptAmountInput("12,000")).toBe("12000");
    expect(acceptAmountInput("1500.5")).toBe("1500.5");
    expect(acceptAmountInput("")).toBe("");
  });

  it("refuses the keystroke rather than truncating, so the caret never jumps", () => {
    expect(acceptAmountInput("123456789012")).toBeNull();
    expect(acceptAmountInput("1.234")).toBeNull();
    expect(acceptAmountInput("abc")).toBeNull();
    expect(acceptAmountInput("12a3")).toBeNull();
    expect(acceptAmountInput("1.2.3")).toBeNull();
  });

  it("refuses a minus sign - amounts are typed unsigned", () => {
    expect(acceptAmountInput("-5")).toBeNull();
  });

  it("lets a lone decimal point stand so the next digit can be typed", () => {
    expect(acceptAmountInput(".")).toBe(".");
  });

  it("follows the currency's places: no point at all for 0", () => {
    expect(acceptAmountInput("12", 0)).toBe("12");
    expect(acceptAmountInput("12.", 0)).toBeNull();
    expect(acceptAmountInput("12.5", 0)).toBeNull();
    expect(acceptAmountInput("1.234", 3)).toBe("1.234");
    expect(acceptAmountInput("1.2345", 3)).toBeNull();
  });
});

describe("toAmountEditString", () => {
  it("strips the grouping so a formatted amount can be edited", () => {
    expect(toAmountEditString("12,000.00")).toBe("12000.00");
    expect(toAmountEditString(1200)).toBe("1200");
  });

  it("is empty for null and undefined", () => {
    expect(toAmountEditString(null)).toBe("");
    expect(toAmountEditString(undefined)).toBe("");
  });

  it("round-trips a formatted amount back through formatAmount", () => {
    expect(formatAmount(toAmountEditString(formatAmount(1234567.891)))).toBe("1,234,567.89");
  });
});
