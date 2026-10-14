/**
 * Part 13 §13.4's five status tones and the pill colours for each (soft background + deep ink, no
 * border - D-09). Which status gets which tone is each app's own map (its `lib/statusTone.ts`):
 * the words differ per module, the tones do not. Submitted and Payment Requested are Info in
 * every module; Voided is Neutral; only a failure (Payment failed, Upload failed) is Danger.
 */

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-status-success-bg text-status-success-ink",
  warning: "bg-status-warning-bg text-status-warning-ink",
  danger: "bg-status-danger-bg text-status-danger-ink",
  info: "bg-status-info-bg text-status-info-ink",
  neutral: "bg-status-neutral-bg text-status-neutral-ink",
};
