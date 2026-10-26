// The amount and count fields (lib/amountInput.ts): commas as you type, the caret kept, places
// padded on blur (owner, 2026-10-26).

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { useAmountInput, type AmountInputOptions } from "../amountInput";

function Harness(props: Partial<AmountInputOptions> & { initial?: string }) {
  const [value, setValue] = useState(props.initial ?? "");
  const amount = useAmountInput({ ...props, value, onValue: setValue });
  return (
    <>
      <input aria-label="Amount" {...amount} />
      <span data-testid="state">{value}</span>
    </>
  );
}

const field = () => screen.getByRole("textbox", { name: "Amount" }) as HTMLInputElement;

describe("useAmountInput", () => {
  it("is a text field with the decimal keyboard", () => {
    render(<Harness />);
    expect(field()).toHaveAttribute("type", "text");
    expect(field()).toHaveAttribute("inputmode", "decimal");
  });

  it("uses the number keyboard for a count or a currency with no places", () => {
    const { unmount } = render(<Harness kind="count" />);
    expect(field()).toHaveAttribute("inputmode", "numeric");
    unmount();
    render(<Harness decimals={0} />);
    expect(field()).toHaveAttribute("inputmode", "numeric");
  });

  it("groups as the person types and hands the grouped text up", async () => {
    render(<Harness />);
    await userEvent.type(field(), "1234567.89");
    expect(field()).toHaveValue("1,234,567.89");
    expect(screen.getByTestId("state")).toHaveTextContent("1,234,567.89");
  });

  it("refuses a 12th digit, a third place and a letter, leaving the field as it was", async () => {
    render(<Harness />);
    await userEvent.type(field(), "123456789012");
    expect(field()).toHaveValue("12,345,678,901");
    await userEvent.type(field(), ".999x");
    expect(field()).toHaveValue("12,345,678,901.99");
  });

  it("keeps the caret on its digit when typing in the middle", async () => {
    render(<Harness initial="1,234" />);
    field().focus();
    field().setSelectionRange(1, 1);
    await userEvent.keyboard("5");
    expect(field()).toHaveValue("15,234");
    expect(field().selectionStart).toBe(2);
  });

  it("Backspace just after a comma removes the digit before it", async () => {
    render(<Harness initial="1,234" />);
    field().focus();
    field().setSelectionRange(2, 2);
    await userEvent.keyboard("{Backspace}");
    expect(field()).toHaveValue("234");
    expect(field().selectionStart).toBe(0);
  });

  it("pads the places on blur, and leaves an empty field empty", async () => {
    render(<Harness />);
    await userEvent.type(field(), "1234.5");
    fireEvent.blur(field());
    expect(field()).toHaveValue("1,234.50");
    fireEvent.change(field(), { target: { value: "" } });
    fireEvent.blur(field());
    expect(field()).toHaveValue("");
  });

  it("shows a plain value from the API grouped", () => {
    render(<Harness initial="1234567.50" />);
    expect(field()).toHaveValue("1,234,567.50");
  });

  it("a count groups, never pads, and stops at maxDigits", async () => {
    render(<Harness kind="count" maxDigits={7} />);
    await userEvent.type(field(), "12345678");
    expect(field()).toHaveValue("1,234,567");
    fireEvent.blur(field());
    expect(field()).toHaveValue("1,234,567");
  });
});
