/**
 * `@minty/shared/profile` (v0.6): My Profile, the sidebar's second view - one implementation for
 * every Next.js app (it was a copy per app; minty-web's `features/profile` is the original).
 * The app supplies its Flask calls and its toast; see `ProfilePanel`.
 */

export { ProfilePanel } from "./ProfilePanel";
export { PROFILE_LOOK, type ProfileLookClasses } from "./looks";
export { ProfileBody } from "./ProfileBody";
export { SubscriptionsOverviewCard } from "./SubscriptionsOverviewCard";
export {
  daysFromToday,
  overviewFigures,
  TRIAL_ENDING_DAYS,
  type OverviewFigures,
  type SubscriptionsList,
} from "./subscriptionsOverview";
export { useProfile, type Draft, type ProfileModel } from "./useProfile";
export {
  isRefusal,
  type Profile,
  type ProfileApi,
  type ProfileChanges,
  type ProfileCompany,
  type ProfileNotify,
  type ProfileRefusal,
  type ProfileUser,
} from "./types";

/**
 * Every file under `public/` the profile renders - the same contract as `SIDEBAR_ASSETS`: Next.js
 * cannot serve a static file out of node_modules, so each consumer holds these and asserts the
 * list against its own `public/` in a test.
 */
export const PROFILE_ASSETS = [
  "/profile/back.svg",
  "/profile/logout.svg",
  "/profile/mail.svg",
  "/profile/person.svg",
  "/profile/super-minty.png",
] as const;
