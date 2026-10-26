"use client";

/**
 * My Profile's body (Figma 10-A / 10-B): the head, the details card, the `subscriptions` slot and
 * Log Out, with the loading and failed states. Whoever draws it reads the profile (`useProfile`)
 * and hands it in - the sidebar's `ProfilePanel`, or an app's own `/profile` page. `look`: the
 * design, when drawn outside a sidebar (else the sidebar's).
 */

import type { ReactNode } from "react";

import type { Look } from "../sidebar/looks";
import { DetailsCard } from "./DetailsCard";
import { LogOutButton, ProfileError, ProfileHero, ProfileLoading } from "./ProfileParts";
import type { ProfileModel } from "./useProfile";
import { useProfileLook } from "./useProfileLook";

export function ProfileBody({
  model: p,
  subscriptions,
  look,
}: {
  model: ProfileModel;
  /** The app's subscription overview card, composed in by its shell - or nothing. */
  subscriptions?: ReactNode;
  look?: Look;
}) {
  const L = useProfileLook(look);
  return (
    <>
      {p.status === "loading" ? <ProfileLoading look={L} /> : null}
      {p.status === "error" ? (
        <ProfileError message={p.error ?? ""} onRetry={p.retry} look={L} />
      ) : null}
      {p.profile ? (
        <>
          <ProfileHero profile={p.profile} look={L} />
          <DetailsCard
            user={p.profile.user}
            draft={p.draft}
            saving={p.saving}
            error={p.saveError}
            emailError={p.emailError}
            onEmailLeave={p.leaveEmail}
            onEdit={p.startEditing}
            onCancel={p.stopEditing}
            onChange={p.change}
            onSave={p.save}
            look={L}
          />
          {subscriptions}
        </>
      ) : null}
      <LogOutButton look={L} />
    </>
  );
}
