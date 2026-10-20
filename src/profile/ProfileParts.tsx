/**
 * My Profile's fixed pieces (Figma 10-A, 1410:3314): the sidebar panel's titlebar (‹ back to the
 * menu, "My Profile", close), the head (the company it was opened from and its plan, the avatar,
 * the name, the role), Log Out, and the loading and failed states. Lifted from minty-web's
 * `features/profile/components/ProfileParts.tsx` (v0.6); the classes are the look's
 * (`./looks.ts`) - `classic` its `main`, `v2` its `development`.
 */

import Image from "next/image";

import { requireSidebarHost } from "../host";
import { Icon } from "../ui/Icon";
import type { ProfileLookClasses } from "./looks";
import { LOG_OUT, PAGE_TITLE, planLabel } from "./profileView";
import type { Profile } from "./types";

/**
 * The sidebar's My Profile titlebar: ‹ goes back to the menu - the panel is the sidebar's second
 * view, not a page - and the close is the way out on a phone, where the panel fills the screen.
 * Heading level 2: the page underneath owns the level 1.
 */
export function ProfilePanelTitlebar({
  look: L,
  onBack,
  onClose,
}: {
  look: ProfileLookClasses;
  onBack?: () => void;
  onClose?: () => void;
}) {
  return (
    <header className={L.titlebar}>
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to the menu"
        className={L.titlebarButton}
      >
        <Image
          className="-scale-x-100"
          src="/profile/back.svg"
          alt=""
          width={24}
          height={24}
          unoptimized
        />
      </button>
      <h2 className={L.titlebarTitle}>{PAGE_TITLE}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close My Profile"
        className={L.titlebarClose}
      >
        {L.closeGlyph === "svg" ? (
          <svg viewBox="0 -960 960 960" width="24" height="24" fill="currentColor" aria-hidden>
            <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
          </svg>
        ) : (
          <Icon name="close" size="lg" />
        )}
      </button>
    </header>
  );
}

export function ProfileHero({ profile, look: L }: { profile: Profile; look: ProfileLookClasses }) {
  const company = profile.entity;
  const plan = planLabel(company);
  const tone = plan
    ? { superminty: L.planSuperMinty, payment: L.planPayment, petty: L.planPetty }[plan.plan]
    : "";
  return (
    <section className="flex flex-col items-center text-center" aria-label="Who you are">
      {company ? (
        // The caped cat hangs 74 px off the name's right (10-B), so beside it the name keeps 74 px
        // clear on BOTH sides - still centred, and wrapping before the cat can reach past the
        // edge (a long company name put a sideways scrollbar under the sidebar's profile).
        <div
          className={`${L.heroCompany} ${plan?.cat ? "max-w-[calc(100%-148px)]" : "max-w-full"}`}
        >
          <p className={L.heroCompanyName}>{company.name}</p>
          {plan ? <p className={`${L.heroPlan} ${tone}`}>{plan.text}</p> : null}
          {plan?.cat ? (
            <Image
              className="absolute -right-[74px] -top-[16px] h-[56px] w-[60px] object-contain"
              src="/profile/super-minty.png"
              alt=""
              width={240}
              height={240}
              unoptimized
            />
          ) : null}
        </div>
      ) : null}
      <span className={`${company ? L.avatarScoped : L.avatarUnscoped} ${L.avatar}`} aria-hidden>
        {profile.user.initials}
      </span>
      <h2 className={L.heroName}>{profile.user.name}</h2>
      {company?.role_label ? <p className={L.role}>{company.role_label}</p> : null}
    </section>
  );
}

/** The host's logout - with any "Leave without saving?" it owes. */
export function LogOutButton({ look: L }: { look: ProfileLookClasses }) {
  return (
    <button type="button" onClick={() => requireSidebarHost().logOut()} className={L.logOut}>
      <Image src="/profile/logout.svg" alt="" width={13} height={13} unoptimized aria-hidden />
      {LOG_OUT}
    </button>
  );
}

export function ProfileLoading({ look: L }: { look: ProfileLookClasses }) {
  return (
    <div className={L.loading} role="status" aria-label="Loading your profile">
      <span className={L.loadingAvatar} />
      <span className={L.loadingName} />
      <span className={L.loadingCard} />
    </div>
  );
}

export function ProfileError({
  message,
  onRetry,
  look: L,
}: {
  message: string;
  onRetry: () => void;
  look: ProfileLookClasses;
}) {
  return (
    <div className={L.error} role="alert">
      <p className={L.errorText}>{message}</p>
      <button type="button" onClick={onRetry} className={L.action}>
        Try again
      </button>
    </div>
  );
}
