// The document reader (src/reader): its generic rules, the one-read-at-a-time hook with the quiet
// failure line's switch, and the classic-look pieces. Each app's own field rules and words are
// tested in the app (minty-petty-cash-web lib/expenseAi.ts, minty-payment-request-web
// lib/invoiceReader.ts).

import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleared,
  createReaderLatch,
  edited,
  failureOf,
  fillable,
  ReaderNote,
  readerState,
  ReadFailedLine,
  ReadingNotice,
  SuggestedLine,
  SUGGESTED_RING,
  suggestionsOf,
  usedNote,
  useDocumentReader,
  withoutDetectedName,
  withoutSuggestions,
  type ReaderSpec,
  type ReaderState,
} from "..";

type V = { date: string; amount: string };
type F = "date" | "amount";
const TODAY = "2026-11-04";
const SPEC: ReaderSpec<V, F> = {
  touchOnSame: true,
  cleared: (field) => (field === "date" ? { date: TODAY } : { amount: "" }),
  same: (field, before, after) =>
    field === "amount" && Number(before.amount) === Number(after.amount),
};
const start = (): ReaderState<V, F> => readerState<V, F>({ date: TODAY, amount: "" });

describe("the answer", () => {
  it("is trusted only in its shape", () => {
    expect(suggestionsOf({ suggestions: { amount: 1 }, reason: null })).toEqual({ amount: 1 });
    expect(suggestionsOf({ suggestions: null, reason: "timeout" })).toBeNull();
    expect(suggestionsOf("nonsense")).toBeNull();
  });

  it("is a failure to mention only when a read came back with nothing", () => {
    for (const reason of [
      "timeout",
      "provider_error",
      "rate_limited",
      "file_too_large",
      "invalid_reply",
    ])
      expect(failureOf({ suggestions: null, reason })).toBe(true);
    for (const reason of ["disabled", "not_configured", "no_context"])
      expect(failureOf({ suggestions: null, reason })).toBe(false);
    expect(failureOf({ suggestions: { amount: {} }, reason: "no_usable_field" })).toBe(false);
    expect(failureOf(null)).toBe(true);
  });
});

describe("the session latch", () => {
  beforeEach(() => sessionStorage.clear());

  it("switches the reader off for the session on an off answer, per reader", () => {
    const receipts = createReaderLatch("test.receipts");
    const invoices = createReaderLatch("test.invoices");
    receipts.noteAnswer({ reason: "timeout" });
    expect(receipts.readerOff()).toBe(false);
    receipts.noteAnswer({ reason: "disabled" });
    expect(receipts.readerOff()).toBe(true);
    expect(invoices.readerOff()).toBe(false);
    expect(sessionStorage.getItem("test.receipts")).toBe("off");
    receipts.reset();
    expect(receipts.readerOff()).toBe(false);
  });
});

describe("the rules around a form's own values", () => {
  it("an untouched default counts as fillable, a touched one never - even re-picked unchanged", () => {
    const s = start();
    expect(fillable(s, "date", false, true)).toBe(true);
    const repicked = edited(s, "date", { date: TODAY }, SPEC);
    expect(repicked.values).toEqual(s.values);
    expect(fillable(repicked, "date", false, true)).toBe(false);
    expect(fillable(repicked, "amount", true)).toBe(true);
  });

  it("without defaults, the same value again is no change at all", () => {
    const s = start();
    expect(edited(s, "amount", { amount: "" }, { cleared: SPEC.cleared })).toBe(s);
  });

  it("an edit takes the marking and the note; an edit the form calls the same keeps them", () => {
    const s: ReaderState<V, F> = {
      ...start(),
      values: { date: "2026-10-20", amount: "45" },
      marks: { date: "high", amount: "high" },
      notes: { amount: { text: "x", fill: { amount: "50" }, band: "high" } },
    };
    const grouped = edited(s, "amount", { amount: "45.00" }, SPEC);
    expect(grouped.marks.amount).toBe("high");
    expect(grouped.values.amount).toBe("45.00");
    const changed = edited(s, "date", { date: "2026-10-21" }, SPEC);
    expect(changed.marks).toEqual({ amount: "high" });
    expect(changed.touched).toEqual({ date: true });
  });

  it("Clear puts a field's default back, not a blank", () => {
    const s: ReaderState<V, F> = {
      ...start(),
      values: { date: "2026-10-20", amount: "45" },
      marks: { date: "high", amount: "medium" },
    };
    expect(cleared(s, "date", SPEC).values.date).toBe(TODAY);
    expect(cleared(s, "amount", SPEC).values.amount).toBe("");
    expect(cleared(start(), "date", SPEC)).toEqual(start()); // only a marked field
  });

  it("a note's value goes in marked; another document takes every suggestion back", () => {
    const s: ReaderState<V, F> = {
      ...start(),
      values: { date: "2026-10-20", amount: "9" },
      marks: { date: "high" },
      notes: { amount: { text: "x", fill: { amount: "50" }, band: "low" } },
      detectedName: "New Co",
    };
    const used = usedNote(s, "amount");
    expect(used.values.amount).toBe("50");
    expect(used.marks.amount).toBe("low");
    const fresh = withoutSuggestions(used, SPEC);
    expect(fresh.values).toEqual({ date: TODAY, amount: "" });
    expect(fresh.marks).toEqual({});
    expect(withoutDetectedName(s).detectedName).toBeNull();
  });
});

describe("useDocumentReader", () => {
  const file = new File(["%PDF-1.4"], "invoice.pdf", { type: "application/pdf" });
  const latch = () => createReaderLatch(`test.reader.${Math.random()}`);

  it("posts the document under its field and hands the suggestions over", async () => {
    const post = vi.fn().mockResolvedValue({ suggestions: { amount: 1 }, reason: null });
    const got = vi.fn();
    const { result } = renderHook(() =>
      useDocumentReader({ post, field: "invoice", latch: latch(), onSuggestions: got }),
    );
    await act(() => result.current.read(file));
    const form = post.mock.calls[0][0] as FormData;
    expect((form.get("invoice") as File).name).toBe("invoice.pdf");
    expect(got).toHaveBeenCalledWith({ amount: 1 });
    expect(result.current).toMatchObject({ reading: false, failed: false });
  });

  it("raises the quiet line for a failed read, a cut connection, or nothing shown", async () => {
    for (const post of [
      vi.fn().mockResolvedValue({ suggestions: null, reason: "timeout" }),
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    ]) {
      const { result } = renderHook(() =>
        useDocumentReader({ post, field: "f", latch: latch(), onSuggestions: () => true }),
      );
      await act(() => result.current.read(file));
      expect(result.current.failed).toBe(true);
    }
    const nothing = vi.fn().mockResolvedValue({ suggestions: { a: 1 }, reason: "no_usable_field" });
    const { result } = renderHook(() =>
      useDocumentReader({ post: nothing, field: "f", latch: latch(), onSuggestions: () => false }),
    );
    await act(() => result.current.read(file));
    expect(result.current.failed).toBe(true);
    act(() => result.current.cancel());
    expect(result.current.failed).toBe(false);
  });

  it("says nothing when switched off, and never reads again that session", async () => {
    const l = latch();
    const post = vi.fn().mockResolvedValue({ suggestions: null, reason: "disabled" });
    const { result } = renderHook(() =>
      useDocumentReader({ post, field: "f", latch: l, onSuggestions: () => true }),
    );
    await act(() => result.current.read(file));
    expect(result.current.failed).toBe(false);
    await act(() => result.current.read(file));
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("drops an answer for a document no longer there", async () => {
    let answer!: (value: unknown) => void;
    const post = vi.fn(() => new Promise((resolve) => (answer = resolve)));
    const got = vi.fn();
    const { result } = renderHook(() =>
      useDocumentReader({ post, field: "f", latch: latch(), onSuggestions: got }),
    );
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.read(file);
    });
    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    act(() => result.current.cancel());
    await act(async () => {
      answer({ suggestions: { a: 1 }, reason: null });
      await pending;
    });
    expect(got).not.toHaveBeenCalled();
    expect(result.current.failed).toBe(false);
  });
});

describe("the classic pieces", () => {
  it("draw the app's words, a 44px Clear and a polite failure line", async () => {
    const clear = vi.fn();
    const use = vi.fn();
    render(
      <>
        <ReadingNotice
          title="Minty is reading the invoice details."
          detail="You can keep typing."
        />
        <SuggestedLine
          id="s1"
          text="Suggested from the invoice. Check it before you submit."
          clearLabel="Clear the suggested value for this field"
          onClear={clear}
        />
        <ReaderNote
          text={'The invoice reads "<b>x</b>".'}
          action="Use the value from the invoice"
          onAction={use}
        />
        <ReadFailedLine text="I couldn't read this invoice. Enter the details yourself." />
      </>,
    );
    expect(screen.getAllByRole("status").map((n) => n.textContent)).toEqual([
      "Minty is reading the invoice details.You can keep typing.",
      "I couldn't read this invoice. Enter the details yourself.",
    ]);
    const button = screen.getByRole("button", { name: "Clear the suggested value for this field" });
    expect(button).toHaveClass("min-h-11", "min-w-11");
    await userEvent.click(button);
    await userEvent.click(screen.getByRole("button", { name: "Use the value from the invoice" }));
    expect(clear).toHaveBeenCalledTimes(1);
    expect(use).toHaveBeenCalledTimes(1);
    expect(screen.getByText('The invoice reads "<b>x</b>".')).toBeInTheDocument(); // text, never markup
    expect(SUGGESTED_RING).toBe("ring-2 ring-[#54D3DA] ring-offset-1");
  });
});
