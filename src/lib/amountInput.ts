/**
 * The amount and count fields' wiring (owner, 2026-10-26): commas as the person types, the caret
 * kept on its digit, the places padded on blur. Spread the returned props on a controlled
 * `<input>`; each app keeps its own markup, label and messages. The value handed to `onValue` is
 * the grouped text ("1,234.5") - parseAmount and toAmountString read it as it is.
 */

import { useLayoutEffect, useRef, type ChangeEvent, type FocusEvent } from "react";

import {
  formatAmount,
  formatAmountTyping,
  formatCountTyping,
  MAX_AMOUNT_DECIMALS,
  type TypingEdit,
  type TypingResult,
} from "./money";

export type AmountInputOptions = {
  /** The field's current value: grouped or plain, it is shown grouped. */
  value: string;
  /** Called with the new grouped text on every accepted edit and on blur. */
  onValue: (value: string) => void;
  /** "amount" (the default) takes a point and pads on blur; "count" is whole numbers. */
  kind?: "amount" | "count";
  /** The currency's places, for an amount. */
  decimals?: number;
  /** Most digits a count may have. */
  maxDigits?: number;
  /** Runs after the padding, for an app's own blur check. */
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
};

export type AmountInputProps = {
  type: "text";
  inputMode: "decimal" | "numeric";
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur: (event: FocusEvent<HTMLInputElement>) => void;
};

/** Most digits a count may have when the caller does not say: PCW's denomination counts. */
const DEFAULT_COUNT_DIGITS = 7;

export function useAmountInput({
  value,
  onValue,
  kind = "amount",
  decimals = MAX_AMOUNT_DECIMALS,
  maxDigits = DEFAULT_COUNT_DIGITS,
  onBlur,
}: AmountInputOptions): AmountInputProps {
  const pending = useRef<{ el: HTMLInputElement; caret: number } | null>(null);

  const format = (edit: TypingEdit): TypingResult =>
    kind === "count" ? formatCountTyping(edit, maxDigits) : formatAmountTyping(edit, decimals);

  // An app may hand in a plain "1234.50" (from the API): show it grouped.
  const shown = format({ text: value, caret: 0 })?.text ?? value;

  // After React writes the value, the caret goes back beside the digit it followed.
  useLayoutEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    if (document.activeElement === p.el) p.el.setSelectionRange(p.caret, p.caret);
  });

  return {
    type: "text",
    inputMode: kind === "amount" && decimals > 0 ? "decimal" : "numeric",
    value: shown,
    onChange: (event) => {
      const el = event.currentTarget;
      const caret = el.selectionStart ?? el.value.length;
      const result = format({
        text: el.value,
        caret,
        previous: shown,
        inputType: (event.nativeEvent as InputEvent).inputType,
      });
      // Written straight away as well as after the render: an edit that leaves the text as it
      // was (a refused key, Backspace at the start) renders nothing, and React would put the
      // caret at the end.
      const next = result ?? {
        text: shown,
        caret: Math.max(0, caret - (el.value.length - shown.length)),
      };
      el.value = next.text;
      el.setSelectionRange(next.caret, next.caret);
      pending.current = { el, caret: next.caret };
      if (result !== null && result.text !== shown) onValue(result.text);
    },
    onBlur: (event) => {
      if (kind === "amount") {
        const padded = formatAmount(shown, decimals);
        if (padded !== shown) onValue(padded);
      }
      onBlur?.(event);
    },
  };
}
