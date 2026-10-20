/**
 * My Profile's rules, pure (Figma 10-A / 10-B, `43YI3MYtTfX5Xzz6dRoRuT` 1410:3314 / 1410:3364):
 * what the plan under the company says, and what the details card refuses before anything is
 * sent. Lifted from minty-web's `features/profile/lib/profileView.ts` (v0.6). The PASSWORD row is
 * gone: Minty holds no password - people sign in with an email code or with Xero (the owner,
 * 2026-10-20).
 */

import { EMAIL_ASCII_HINT, hasNonAsciiEmailChar } from "../lib/emailInput";
import type { ProfileChanges, ProfileCompany } from "./types";

export const PAGE_TITLE = "My Profile";
export const FIRST_NAME = "FIRST NAME";
export const LAST_NAME = "LAST NAME";
export const EDIT = "Edit";
export const LOG_OUT = "Log Out";
export const SAVE = "Save";
export const CANCEL = "Cancel";
export const LOAD_FAILED = "Your profile didn't come through. Mind trying again?";
export const SAVE_FAILED = "That didn't quite save. Mind trying again?";
export const EMAIL_REQUIRED = "We'll need an email here.";
export const SAVED = "Your profile is saved.";

export type PlanLabel = { text: string; plan: "superminty" | "payment" | "petty"; cat: boolean };

/**
 * The line under the company: its plan. Both modules on is "SuperMinty" (10-B, with the caped
 * cat); one is that module's name; none, nothing. Its colour is the look's (`./looks.ts`).
 */
export function planLabel(company: ProfileCompany | null): PlanLabel | null {
  if (!company) return null;
  const petty = company.modules.includes("PETTY_CASH");
  const payments = company.modules.includes("PAYMENT_REQUEST");
  if (petty && payments) return { text: "SuperMinty", plan: "superminty", cat: true };
  if (payments) return { text: "Payment Request", plan: "payment", cat: false };
  if (petty) return { text: "Petty Cash", plan: "petty", cat: false };
  return null;
}

/** Only what changed is sent; an emptied email is refused here, with the old profile's words. */
export function changesFrom(
  draft: Required<ProfileChanges>,
  saved: Required<ProfileChanges>,
): { changes: ProfileChanges; error: string | null } {
  if (!draft.email.trim()) return { changes: {}, error: EMAIL_REQUIRED };
  if (hasNonAsciiEmailChar(draft.email)) return { changes: {}, error: EMAIL_ASCII_HINT };
  const changes: ProfileChanges = {};
  for (const key of ["first_name", "last_name", "email"] as const) {
    if (draft[key].trim() !== saved[key]) changes[key] = draft[key];
  }
  return { changes, error: null };
}
