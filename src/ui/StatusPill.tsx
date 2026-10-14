/**
 * Part 14 "Status pill": ~24px, padding 4/12, full radius, soft background + deep ink. Not
 * interactive; the TEXT carries the meaning, the colour only repeats it (never colour alone).
 * Status is always a pill - never a button in the Status column (Part 15.2).
 */

import { TONE_CLASS, type StatusTone } from "./statusTone";

export function StatusPill({
  label,
  tone,
  className,
}: {
  /** The display label - "Payment Requested", "Submitted", ... */
  label: string;
  /** The label's tone, from the app's own status map (its `lib/statusTone.ts`). */
  tone: StatusTone;
  className?: string;
}) {
  return (
    <span
      data-tone={tone}
      className={`inline-flex min-h-6 max-w-full items-center rounded-full px-3 py-1 text-label whitespace-nowrap ${TONE_CLASS[tone]}${className ? ` ${className}` : ""}`}
    >
      {label}
    </span>
  );
}
