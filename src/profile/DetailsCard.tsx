/**
 * The details card (Figma 10-A): first and last name and the email - each on its teal tile - with
 * "Edit" in the corner. Editing happens in the card: the names and the email become fields,
 * "Edit" becomes "Cancel", and Save sits under them; a refusal is shown in the card, in Flask's
 * words. No PASSWORD row: Minty holds no password (the owner, 2026-10-20). The classes are the
 * look's (`./looks.ts`).
 */

import Image from "next/image";
import type { ReactNode } from "react";

import { EMAIL_ASCII_HINT, useEmailInput } from "../lib/emailInput";
import type { ProfileLookClasses } from "./looks";
import { CANCEL, EDIT, FIRST_NAME, LAST_NAME, SAVE } from "./profileView";
import type { ProfileUser } from "./types";
import type { Draft } from "./useProfile";

function Tile({
  src,
  width,
  height,
  className,
}: {
  src: string;
  width: number;
  height: number;
  className: string;
}) {
  return (
    <span className={className} aria-hidden>
      <Image src={src} alt="" width={width} height={height} unoptimized />
    </span>
  );
}

function Row({
  tile,
  className,
  children,
}: {
  tile: ReactNode;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      {tile}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export type DetailsCardProps = {
  user: ProfileUser;
  draft: Draft | null;
  saving: boolean;
  error: string | null;
  onEdit: () => void;
  onCancel: () => void;
  onChange: (field: keyof Draft, value: string) => void;
  onSave: () => void;
  look: ProfileLookClasses;
};

export function DetailsCard({
  user,
  draft,
  saving,
  error,
  onEdit,
  onCancel,
  onChange,
  onSave,
  look: L,
}: DetailsCardProps) {
  const editing = draft !== null;
  const emailInput = useEmailInput((value) => onChange("email", value));
  return (
    <section className={L.card} aria-label="Your details">
      <div className={L.editRow}>
        <button
          type="button"
          onClick={editing ? onCancel : onEdit}
          disabled={saving}
          className={L.editButton}
        >
          {editing ? CANCEL : EDIT}
        </button>
      </div>

      <form
        className="flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <Row
          className={L.row}
          tile={<Tile className={L.tile} src="/profile/person.svg" width={18} height={18} />}
        >
          <div className="grid grid-cols-2 gap-x-4">
            <div>
              <p className={L.label} id="profile-first-name">
                {FIRST_NAME}
              </p>
              {editing ? (
                <input
                  className={L.field}
                  aria-labelledby="profile-first-name"
                  value={draft.first_name}
                  onChange={(e) => onChange("first_name", e.target.value)}
                  autoComplete="given-name"
                  maxLength={255}
                />
              ) : (
                <p className={`${L.value} truncate`}>{user.first_name}</p>
              )}
            </div>
            <div>
              <p className={L.label} id="profile-last-name">
                {LAST_NAME}
              </p>
              {editing ? (
                <input
                  className={L.field}
                  aria-labelledby="profile-last-name"
                  value={draft.last_name}
                  onChange={(e) => onChange("last_name", e.target.value)}
                  autoComplete="family-name"
                  maxLength={255}
                />
              ) : (
                <p className={`${L.value} truncate`}>{user.last_name}</p>
              )}
            </div>
          </div>
        </Row>

        <div className="mt-3">
          <Row
            className={L.row}
            tile={<Tile className={L.tile} src="/profile/mail.svg" width={16} height={13} />}
          >
            {editing ? (
              <>
                <input
                  className={L.field}
                  {...emailInput.props}
                  aria-label="Email"
                  // Mandatory (profileView refuses a blank one), but this card shows no visible
                  // label for it - only a mail tile - so there is nowhere to hang the asterisk.
                  // Announced here; a visible label is a layout decision, not a code one.
                  aria-required="true"
                  aria-describedby={emailInput.rejected ? "profile-email-hint" : undefined}
                  value={draft.email}
                  maxLength={255}
                />
                {emailInput.rejected && (
                  <p id="profile-email-hint" className={L.emailHint} role="status">
                    {EMAIL_ASCII_HINT}
                  </p>
                )}
              </>
            ) : (
              <p className={`${L.value} truncate`}>
                <span className="sr-only">Email </span>
                {user.email}
              </p>
            )}
          </Row>
        </div>

        {editing ? (
          <div className="mt-4 flex flex-col items-end gap-2">
            {error ? (
              <p className={L.saveError} role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={saving} className={L.save}>
              {saving ? "Saving…" : SAVE}
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
