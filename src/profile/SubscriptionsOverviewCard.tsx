"use client";

/**
 * My Profile's "Subscriptions Overview" (Figma 10-A / 10-B): how many companies the person pays
 * for, how many have a trial ending, and Manage Subscription into minty-web's portal (08-A) - or,
 * paying for none, "It looks a little quiet here. No entity subscriptions yet." Lifted from
 * minty-web's `features/subscription/routes/SubscriptionsOverviewCard.tsx` (v0.6); the figures are
 * its `overview`'s (`./subscriptionsOverview.ts`), so the profile and the portal never disagree.
 *
 * The app hands in its read of subscription-api's `/api/me/subscriptions` (every page) as `load`,
 * and composes the card into the panel's `subscriptions` slot. Manage Subscription is the host's
 * `links.subscriptions()` - minty-web's portal, through the hand-off from any other app.
 *
 * A read that fails says so in the card, with Try again; a 401 says nothing (the app is already
 * re-signing in). `load` should be stable (module-level), as `ProfilePanel`'s `api`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { requireSidebarHost } from "../host";
import type { Look } from "../sidebar/looks";
import type { ProfileLookClasses } from "./looks";
import { entityUnit, overviewFigures, type SubscriptionsList } from "./subscriptionsOverview";
import { isRefusal } from "./types";
import { useProfileLook } from "./useProfileLook";

export const PROFILE_OVERVIEW_TITLE = "Subscriptions Overview";
export const ACTIVE_SUBSCRIPTIONS = "Active subscriptions";
export const TRIAL_ENDING = "Trial ending";
export const MANAGE_SUBSCRIPTION = "Manage Subscription";
export const NO_SUBSCRIPTIONS = "It looks a little quiet here. No entity subscriptions yet.";
export const OVERVIEW_LOAD_FAILED = "Your subscriptions didn't load. Mind trying again?";

type Loaded = { attempt: number; list: SubscriptionsList | null; error: string | null };

function Figure({
  label,
  value,
  tone,
  look: L,
}: {
  label: string;
  value: number;
  tone: string;
  look: ProfileLookClasses;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className={L.figureLabel}>{label}</p>
      <p className={`${L.figureValue} ${tone}`}>{value}</p>
      <p className={L.figureUnit}>{entityUnit(value)}</p>
    </div>
  );
}

/** `today`: tests only. */
export function SubscriptionsOverviewCard({
  load,
  today,
  look,
}: {
  load: (signal: AbortSignal) => Promise<SubscriptionsList>;
  today?: Date;
  /** The design; omitted, the sidebar provider's `look`. */
  look?: Look;
}) {
  const L = useProfileLook(look);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((list) => {
        if (!controller.signal.aborted) setLoaded({ attempt, list, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (isRefusal(err) && err.status === 401) return; // re-authenticating
        setLoaded({ attempt, list: null, error: OVERVIEW_LOAD_FAILED });
      });
    return () => controller.abort();
  }, [load, attempt]);

  const status =
    loaded === null || loaded.attempt !== attempt ? "loading" : loaded.error ? "error" : "ready";
  const list = status === "ready" ? (loaded?.list ?? null) : null;
  const figures = useMemo(
    () => (list ? overviewFigures(list, today ?? new Date()) : null),
    [list, today],
  );
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <section className={L.overview} aria-labelledby="profile-subscriptions-overview">
      <h2 id="profile-subscriptions-overview" className={L.overviewTitle}>
        {PROFILE_OVERVIEW_TITLE}
      </h2>
      <div className={L.overviewBox}>
        {status === "loading" ? (
          <div
            className={L.overviewLoading}
            role="status"
            aria-label="Loading your subscriptions"
          />
        ) : null}
        {status === "error" ? (
          <div className="flex flex-col items-center gap-3 text-center" role="alert">
            <p className={L.overviewErrorText}>{loaded?.error}</p>
            <button type="button" onClick={retry} className={L.overviewRetry}>
              Try again
            </button>
          </div>
        ) : null}
        {list && list.entities.length === 0 ? (
          <p className={L.overviewEmpty}>{NO_SUBSCRIPTIONS}</p>
        ) : null}
        {list && list.entities.length > 0 && figures ? (
          <>
            <div className={L.figures}>
              <Figure
                label={ACTIVE_SUBSCRIPTIONS}
                value={figures.active}
                tone={L.activeTone}
                look={L}
              />
              <Figure
                label={TRIAL_ENDING}
                value={figures.trialEnding}
                tone={L.trialTone}
                look={L}
              />
            </div>
            <a href={requireSidebarHost().links.subscriptions()} className={L.manage}>
              {MANAGE_SUBSCRIPTION}
            </a>
          </>
        ) : null}
      </div>
    </section>
  );
}
