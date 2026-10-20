/**
 * My Profile's data: Flask's `GET` / `PATCH /api/me/profile` (Minty's
 * `blueprints/user_management/routes/me_api.py`). The package never fetches it itself - each app
 * reaches Flask with its own bearer token and hands the two calls in as a `ProfileApi`.
 */

export type ProfileUser = {
  id: string;
  first_name: string;
  last_name: string;
  /** "First Last", or the email when the account has no name. */
  name: string;
  /** The avatar's letters; "?" with no name at all. */
  initials: string;
  email: string;
};

export type ProfileCompany = {
  id: string;
  name: string;
  /** `entity_role`, or null for a superuser who is not a member. */
  role: string | null;
  /** "Shop Manager" - Flask's own words for the role. */
  role_label: string | null;
  /** Module codes switched on: `PETTY_CASH`, `PAYMENT_REQUEST`. */
  modules: string[];
};

export type Profile = { user: ProfileUser; entity: ProfileCompany | null };

export type ProfileChanges = Partial<Pick<ProfileUser, "first_name" | "last_name" | "email">>;

/**
 * The app's two calls. `entityId` is the company in the app's cookie ("" for none): Flask then
 * names the company, the person's role there and its modules (`?entity=`).
 *
 * A refusal REJECTS with `{ status, message }` - Flask's answer, its sentence shown as it stands.
 * A 401 means the app is already sending the browser for a fresh token, so nothing is shown. Any
 * other rejection (a network failure) gets the panel's own "didn't come through" words.
 */
export type ProfileApi = {
  load(entityId: string, signal: AbortSignal): Promise<Profile>;
  save(changes: ProfileChanges, entityId: string): Promise<Profile>;
};

export type ProfileRefusal = { status: number; message: string };

/** The app's toast. */
export type ProfileNotify = (message: string, kind: "success" | "error") => void;

export function isRefusal(err: unknown): err is ProfileRefusal {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as ProfileRefusal).status === "number" &&
    typeof (err as ProfileRefusal).message === "string"
  );
}
