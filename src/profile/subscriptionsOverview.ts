/**
 * The overview's figures, pure - minty-web's `features/subscription/lib/billing.ts::overview`
 * (the figures only; 08-A's update lines stay the portal's), lifted here so the profile in every
 * app counts as the portal does. Change the two together. Days are counted by lib/dates.ts's
 * daysFromToday (re-exported here for `@minty/shared/profile`).
 */

import { daysFromToday } from "../lib/dates";

export { daysFromToday };

/** What the card reads: the person's companies and each one's modules, from subscription-api's
 *  `GET /api/me/subscriptions` (every page). Only these fields are looked at. `can_manage` false
 *  marks a company the person only VIEWS (an admin or accountant of it; someone else pays - v0.19);
 *  missing reads as their own, as every row was before. */
export type SubscriptionsList = {
  entities: { can_manage?: boolean; modules: { status: string; date_iso: string | null }[] }[];
};

/** The companies the person may change - their own subscriptions, not the ones they only view. */
export function ownEntities<T extends { can_manage?: boolean }>(entities: T[]): T[] {
  return entities.filter((e) => e.can_manage !== false);
}

export type OverviewFigures = { active: number; trialEnding: number };

/**
 * How far off a trial's end may be and still count as "Trial ending": thirty days, a trial's
 * whole length (the user's call, 2026-09-25) - minty-web's `TRIAL_ENDING_DAYS`.
 */
export const TRIAL_ENDING_DAYS = 30;

/**
 * "Active subscriptions" counts COMPANIES - once however many modules - with any module active or
 * cancelled (a trial is not active: nothing is charged yet). "Trial ending" counts the companies
 * with a trial ending within `TRIAL_ENDING_DAYS`. Only the person's own (`ownEntities`): a
 * company they only view is someone else's subscription.
 */
export function overviewFigures(list: SubscriptionsList, today: Date): OverviewFigures {
  let active = 0;
  let trialEnding = 0;
  for (const entity of ownEntities(list.entities)) {
    if (entity.modules.some((m) => m.status === "active" || m.status === "cancelled")) active += 1;
    const ending = entity.modules.some((m) => {
      if (m.status !== "trialing") return false;
      const left = daysFromToday(m.date_iso, today);
      return left !== null && left <= TRIAL_ENDING_DAYS;
    });
    if (ending) trialEnding += 1;
  }
  return { active, trialEnding };
}

/** "entity" / "entities" - the unit under a figure. */
export function entityUnit(n: number): string {
  return n === 1 ? "entity" : "entities";
}
