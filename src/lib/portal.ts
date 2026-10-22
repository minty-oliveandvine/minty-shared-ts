/**
 * The person-scoped reads every app's sidebar makes - My Profile, its Subscriptions Overview and
 * the header's initials - one implementation over whatever bearer client the app has (the
 * shared-code refactor, 2026-10-21; each app had its own `profileApi`, its own page walk of
 * `/api/me/subscriptions` and its own `loadViewer`).
 *
 * Generic over a passed `fetchJson`: the app's client for the right backend (Flask's hub API for
 * the profile, minty-subscription-api for the subscriptions), carrying its token, its 401 rule and
 * its refusal sentences. A refusal rejects with whatever that client throws.
 *
 * Person-scoped: no `X-Entity-Id`. A company travels as `?entity=` (the profile) - Flask allows
 * only `Authorization` and `Content-Type`.
 */

import type { Profile, ProfileApi, ProfileChanges } from "../profile/types";

export type PortalQuery = Record<string, string | number | boolean | null | undefined>;

export type PortalRequest = {
  query?: PortalQuery;
  signal?: AbortSignal;
  method?: string;
  /** A JSON body; the client serialises it. */
  body?: unknown;
};

/** The app's JSON client: the parsed answer, or a rejection (its error class, its sentence). */
export type FetchJson = <T>(path: string, init?: PortalRequest) => Promise<T>;

// --- My Profile ------------------------------------------------------------------------------------

export const PROFILE_PATH = "/api/me/profile";

/** `?entity=<id>` only when there is a company; none at all otherwise. */
const entityQuery = (entityId: string | null | undefined): PortalQuery | undefined =>
  entityId ? { entity: entityId } : undefined;

/** `ProfileApi` (what the panel takes), with the company and the signal optional. */
export type ProfileClient = {
  load(entityId?: string | null, signal?: AbortSignal): Promise<Profile>;
  save(changes: ProfileChanges, entityId?: string | null, signal?: AbortSignal): Promise<Profile>;
};

// Checked here, so a change to the panel's contract fails this file rather than an app.
const _isProfileApi: (c: ProfileClient) => ProfileApi = (c) => c;
void _isProfileApi;

/**
 * My Profile's read and its one write - Flask's `GET` / `PATCH /api/me/profile` - in the shape the
 * packaged panel takes (`ProfileApi`), so the result is handed to it as it is. `entityId` is the
 * company the profile was opened from (the cookie's; "" for none). Call once, at module level: the
 * panel reads again whenever `api` changes identity.
 */
export function createProfileApi(fetchJson: FetchJson): ProfileClient {
  return {
    load: (entityId, signal) =>
      fetchJson<Profile>(PROFILE_PATH, { query: entityQuery(entityId), signal }),
    save: (changes, entityId, signal) =>
      fetchJson<Profile>(PROFILE_PATH, {
        method: "PATCH",
        body: changes,
        query: entityQuery(entityId),
        signal,
      }),
  };
}

/** The header's initials and the menu's name - and nothing else of the profile. */
export type PortalViewer = { name: string; initials: string };

/**
 * The sidebar host's `loadViewer`: the person's name and initials from `/api/me/profile`, or null
 * when the answer lacks either. Decoration: pass a `fetchJson` whose 401 only REJECTS (the
 * client's `onUnauthorized: "reject"`), so a lapsed token never moves the page from the badge -
 * the page's own reads deal with that.
 */
export async function loadViewer(fetchJson: FetchJson): Promise<PortalViewer | null> {
  const body = await fetchJson<{ user?: { name?: unknown; initials?: unknown } } | null>(
    PROFILE_PATH,
  );
  const user = body?.user;
  if (typeof user?.name !== "string" || typeof user.initials !== "string") return null;
  return { name: user.name, initials: user.initials };
}

// --- Subscriptions ---------------------------------------------------------------------------------

/**
 * Seven statuses, not the four the design draws swatches for. `past_due`, `ended` and
 * `trial_expired` are splits of what would otherwise be a grey "not subscribed" that lies.
 */
export type ModuleStatus =
  "active" | "trialing" | "cancelled" | "past_due" | "ended" | "trial_expired" | "not_subscribed";

export type PortalModule = {
  code: string;
  name: string;
  status: ModuleStatus;
  /** What the badge reads, e.g. "free trial". Server-owned so every app says it the same way. */
  status_label: string;
  /** "Next billing" / "Trial ends" / "Expires" / "Access ends" / "Ended", or null. */
  date_label: string | null;
  /** Already formatted - "15 Aug 2026". Null when there is no date to show. */
  date: string | null;
  date_iso: string | null;
};

export type PortalEntity = {
  entity_id: string;
  entity_name: string;
  country: string | null;
  country_code: string | null;
  /**
   * Who carries this company's bill - null when nobody does yet. A trial is started by any admin
   * and establishes no subscriber, so the list also carries the companies the viewer ADMINISTERS
   * that nobody pays for, and those rows offer Activate Subscription.
   */
  subscriber: { id: string; name: string; email: string } | null;
  /** False on exactly those rows. Absent on an older answer, which means "it has one". */
  has_subscriber?: boolean;
  modules: PortalModule[];
  /** A Minty PATH. Hand the token back through Flask's /entity/<id>/enter to land on it signed in. */
  settings_path: string;
  /** ISO; when the company was created (the Manage Subscriptions list is newest first). */
  created_at?: string | null;
};

/**
 * How one of the payer's OWN offers ended, where they have not been shown yet (07-I / A-07 for a
 * decline, A-08 for an expiry, 07-L for an accept).
 */
export type TransferOutcomeRow = {
  id: string;
  entity_id: string;
  entity_name: string;
  status: "declined" | "expired" | "accepted";
  /** The other party, named - the modal's title is "<Name> declined the transfer". */
  who: string;
  responded_at: string | null;
};

export type PortalPayer = { id: string; name: string; email: string };

export type PortalBilling = {
  /** The cycle's START - the payer's first charge. Never a date to print as "next". */
  anchor: string | null;
  anchor_iso: string | null;
  paid_through: string | null;
  paid_through_iso: string | null;
  /** The date the payer is next billed: the end of the anchor period now is in. */
  next_billing?: string | null;
  next_billing_iso?: string | null;
  currency: string | null;
};

/** One page of `GET /api/me/subscriptions` - the fields the walk reads. */
type SubscriptionsPage = {
  payer?: PortalPayer;
  billing?: PortalBilling;
  transfer_outcomes?: TransferOutcomeRow[];
  entities: PortalEntity[];
  pages?: number;
};

export type AllSubscriptions = {
  /** From the first page (absent on an answer that has none). */
  payer: PortalPayer | undefined;
  billing: PortalBilling | undefined;
  /** Every page's companies, in order. */
  entities: PortalEntity[];
  /** From the FIRST page only - a fact about the payer, repeated on every page. Empty when none. */
  transfer_outcomes: TransferOutcomeRow[];
};

export const SUBSCRIPTIONS_PATH = "/api/me/subscriptions";

/** The API's page-size ceiling (`MAX_PER_PAGE` in its portal service). */
export const MAX_PER_PAGE = 100;

/** What a page that is not the expected shape is refused with: a 502 in the house voice. */
export const UNEXPECTED_SHAPE = "That came back in a shape I didn't expect. Mind trying again?";

/** A refusal the walk makes itself - `{ status, message }`, as the profile panel reads one. */
export class PortalShapeError extends Error {
  readonly status = 502;

  constructor(message: string = UNEXPECTED_SHAPE) {
    super(message);
    this.name = "PortalShapeError";
  }
}

export type FetchAllSubscriptionsOptions = {
  signal?: AbortSignal;
  /** More of the list's query (`q`, `sort`, `direction`); `page` and `per_page` are the walk's. */
  query?: PortalQuery;
  /** The app's own error for a wrong shape (its ApiError(502, UNEXPECTED_SHAPE)). */
  shapeError?: (status: 502, message: string) => Error;
};

/**
 * Every company the person is responsible for, in one list: the design scrolls, it does not page,
 * so the pages are walked here, `per_page=100`, one after another. Only page 1's `pages` is read
 * (0 or missing is one call). A page that is not the expected shape - no `entities` array - fails
 * the whole walk with a 502; a refused page rejects with the client's own error.
 */
export async function fetchAllSubscriptions(
  fetchJson: FetchJson,
  options: FetchAllSubscriptionsOptions = {},
): Promise<AllSubscriptions> {
  const { signal, query, shapeError } = options;
  const page = async (n: number): Promise<SubscriptionsPage> => {
    const data = await fetchJson<SubscriptionsPage | null>(SUBSCRIPTIONS_PATH, {
      query: { ...query, page: n, per_page: MAX_PER_PAGE },
      signal,
    });
    if (!data || !Array.isArray(data.entities)) {
      throw shapeError ? shapeError(502, UNEXPECTED_SHAPE) : new PortalShapeError();
    }
    return data;
  };

  const first = await page(1);
  const entities = [...first.entities];
  const pages = typeof first.pages === "number" ? first.pages : 1;
  for (let n = 2; n <= pages; n++) entities.push(...(await page(n)).entities);
  return {
    payer: first.payer,
    billing: first.billing,
    entities,
    transfer_outcomes: first.transfer_outcomes ?? [],
  };
}
