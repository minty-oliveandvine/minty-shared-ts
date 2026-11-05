/**
 * The "Talk to Minty" cat and chat in the two designs - the same rule as `../sidebar/looks.ts`:
 *
 * - `v2` - Part 13 semantic tokens (every `redesign` branch loads `tokens.css`).
 * - `classic` - the values written in, because the `main`/`development` apps do not all load
 *   `tokens.css` (minty-onboarding-web loads none). Unlike the classic sidebar and profile this
 *   is a NEW screen, so its Primary CTA is Minty Action #3CBCC3 (hover #35B2B9, pressed
 *   #2FA4AB) with a white 14px SemiBold label, never Brand #54D3DA; text #2B2B2B / #656565.
 *
 * Geometry is shared and lives in the components; only colour, border and shadow differ here.
 * The cat itself stands on the page with no button behind it (owner, 2026-11-05) - only its
 * focus ring is per look.
 */

import type { Look } from "../sidebar/looks";

export const CONTACT_LOOK = {
  v2: {
    cat: "focus-visible:outline-border-focus",
    popup: "bg-surface-raised border border-border-default shadow-modal",
    popupTail: "bg-surface-raised border-r border-b border-border-default",
    popupGreeting: "text-text-primary",
    popupItem: "text-text-primary hover:bg-state-hover focus-visible:outline-border-focus",
    popupIcon: "text-text-link",
    window: "bg-surface-page sm:border sm:border-border-default sm:shadow-modal",
    header: "border-b border-border-subtle bg-surface-raised",
    title: "text-text-primary",
    subtitle: "text-text-secondary",
    close: "text-text-secondary hover:bg-state-hover focus-visible:outline-border-focus",
    minty: "bg-surface-raised border border-border-subtle text-text-primary",
    me: "bg-state-selected text-text-primary",
    chip: "border border-border-selected text-text-link bg-surface-raised hover:bg-state-hover focus-visible:outline-border-focus",
    composer: "border-t border-border-subtle bg-surface-raised",
    label: "text-text-secondary",
    field:
      "border border-border-input bg-surface-card text-text-primary focus:border-border-selected focus:ring-1 focus:ring-border-selected/25",
    fieldInvalid: "border-2! border-action-danger! focus:ring-action-danger/25!",
    problem: "text-status-danger-ink",
    counter: "text-text-secondary",
    primary:
      "bg-action-primary text-action-on-primary hover:bg-action-primary-hover active:bg-action-primary-pressed focus-visible:outline-border-focus",
    secondary:
      "border border-border-default bg-surface-raised text-text-primary hover:bg-state-hover focus-visible:outline-border-focus",
    dot: "bg-text-secondary",
    review: "border border-border-default bg-surface-raised",
    row: "border border-border-default bg-surface-raised text-text-primary hover:bg-state-hover",
    rowSelected: "border-border-selected! bg-state-selected!",
    rowFocus: "has-[:focus-visible]:outline-border-focus",
    rowMark: "text-text-secondary",
    radioOn: "border-border-selected",
    radioOff: "border-border-input",
    radioDot: "bg-border-selected",
    footer: "border-t border-border-subtle",
    footerAction: "text-text-link hover:bg-state-hover focus-visible:outline-border-focus",
  },
  classic: {
    cat: "focus-visible:outline-[#3CBCC3]",
    popup: "bg-white border border-[#E5E7EB] shadow-[0_8px_28px_rgba(17,19,19,0.16)]",
    popupTail: "bg-white border-r border-b border-[#E5E7EB]",
    popupGreeting: "text-[#2B2B2B]",
    popupItem: "text-[#2B2B2B] hover:bg-[#F1F8F8] focus-visible:outline-[#3CBCC3]",
    popupIcon: "text-[#2FA4AB]",
    window: "bg-[#F7F9F9] sm:border sm:border-[#E5E7EB] sm:shadow-[0_12px_40px_rgba(17,19,19,0.2)]",
    header: "border-b border-[#ECEFEF] bg-white",
    title: "text-[#2B2B2B]",
    subtitle: "text-[#656565]",
    close: "text-[#656565] hover:bg-[#F1F8F8] focus-visible:outline-[#3CBCC3]",
    minty: "bg-white border border-[#ECEFEF] text-[#2B2B2B]",
    me: "bg-[#E3F5F6] text-[#2B2B2B]",
    chip: "border border-[#3CBCC3] text-[#1F7F84] bg-white hover:bg-[#F1F8F8] focus-visible:outline-[#3CBCC3]",
    composer: "border-t border-[#ECEFEF] bg-white",
    label: "text-[#656565]",
    field:
      "border border-[#D1D5DB] bg-white text-[#2B2B2B] focus:border-[#3CBCC3] focus:ring-1 focus:ring-[#3CBCC3]/25",
    fieldInvalid: "border-2! border-[#D93025]! focus:ring-[#D93025]/25!",
    problem: "text-[#B3261E]",
    counter: "text-[#656565]",
    primary:
      "bg-[#3CBCC3] text-white hover:bg-[#35B2B9] active:bg-[#2FA4AB] focus-visible:outline-[#2FA4AB]",
    secondary:
      "border border-[#D1D5DB] bg-white text-[#2B2B2B] hover:bg-[#F1F8F8] focus-visible:outline-[#3CBCC3]",
    dot: "bg-[#9CA3AF]",
    review: "border border-[#E5E7EB] bg-white",
    row: "border border-[#E5E7EB] bg-white text-[#2B2B2B] hover:bg-[#F1F8F8]",
    rowSelected: "border-[#3CBCC3]! bg-[#E3F5F6]!",
    rowFocus: "has-[:focus-visible]:outline-[#3CBCC3]",
    rowMark: "text-[#656565]",
    radioOn: "border-[#3CBCC3]",
    radioOff: "border-[#C4C9CF]",
    radioDot: "bg-[#3CBCC3]",
    footer: "border-t border-[#ECEFEF]",
    footerAction: "text-[#1F7F84] hover:bg-[#F1F8F8] focus-visible:outline-[#3CBCC3]",
  },
} as const satisfies Record<Look, Record<string, string>>;

export type ContactLookClasses = (typeof CONTACT_LOOK)[Look];
