/**
 * The one way an app talks to a bearer-authenticated backend: Flask's hub surface, the
 * subscription API, the Petty Cash API, the payment-request API.
 *
 * - The bearer comes from the app (`getToken`); `X-Entity-Id` is sent only when the app's
 *   `entityHeader` answers a non-empty id (Flask's CORS allows only `Authorization` and
 *   `Content-Type`, so a client for Flask passes none).
 * - A 401 - or no token at all - goes to `onUnauthorized`. `"reject"` rejects at once with
 *   `ApiError(401, SESSION_ENDED, null)`. A function decides: `true` retries ONCE with a fresh
 *   `getToken()` (payment-request's refresh), `false` rejects with the same error (minty-web's
 *   and petty-cash's re-handoff navigate first, then answer false). It may also throw its own
 *   error, which the call rejects with (payment-request's "you don't have access" for a 401 on a
 *   live token). After a retry it is told so (`retried: true`) and its answer no longer matters:
 *   the call rejects.
 * - With no token the call is never made: the callback hears `reason: "no-token"`.
 * - Every other non-2xx rejects with `ApiError(status, errorSentence(body, fallback), body)` -
 *   the body's own sentence when it reads as one, never a machine code. A dropped connection is
 *   NOT wrapped: it stays fetch's TypeError, so catch sites narrow to ApiError.
 *
 * Merged from minty-web's and minty-petty-cash-web's lib/apiClient.ts and
 * minty-payment-request-web's lib/api.ts and components/ui/sidebarHost.ts.
 */

import { HOUSE_FALLBACK, friendlyError } from "./errorCopy";

export { HOUSE_FALLBACK };

/** What a 401 rejects with: the browser is (or is about to be) on its way to a fresh token. */
export const SESSION_ENDED = "Your session has ended. Signing you back in…";

/**
 * A refused call. `message` is the copy a person reads; `body` is what the server sent (parsed
 * JSON, its text, or null) for a caller that branches on it.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  /**
   * The server's own words, before they were made fit to show - what shape-detectors match on
   * (payment-request's duplicate-reference and Xero-connection checks), because `message` is
   * scrubbed of exactly those shapes. A text body is itself; an object body's `error`, `detail`
   * or `message` (a non-string one serialised as JSON); otherwise `message`. Match on it, never
   * render it.
   */
  get detail(): string {
    const body = this.body;
    if (typeof body === "string") return body;
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      const raw = record.error ?? record.detail ?? record.message;
      if (typeof raw === "string") return raw;
      if (raw !== undefined && raw !== null) return JSON.stringify(raw);
    }
    return this.message;
  }

  /**
   * The refused inputs, one sentence each, keyed by the field's name as it was sent - the
   * APIs' envelope `{"error", "fields"}` (minty-shared-py, 2026-10-22), for inline messages.
   * Empty when the body carries none; a non-string entry is dropped, never shown.
   */
  get fields(): Record<string, string> {
    const body = this.body;
    if (!body || typeof body !== "object") return {};
    const raw = (body as Record<string, unknown>).fields;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) out[key] = value;
    }
    return out;
  }
}

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

/**
 * `path` with `query` appended, form-encoded. undefined, null and "" are dropped; booleans and
 * numbers are written as text. A path that already has a "?" is joined with "&". No "?" at all
 * when nothing is left.
 */
export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  if (!s) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${s}`;
}

/** A response's body: null when empty, the parsed value when JSON, otherwise its text. */
export async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * The sentence for a failed response's body: the first non-empty `error`, `detail` or `message`
 * (a list or field map flattened), kept only when it reads as prose (errorCopy) - otherwise
 * `fallback`.
 */
export function errorSentence(body: unknown, fallback: string = HOUSE_FALLBACK): string {
  return friendlyError(body, fallback);
}

/** What `onUnauthorized` is told. */
export type UnauthorizedContext = {
  /** The path the call was for (without the base or the query). */
  path: string;
  /** `"no-token"`: there was nothing to send, and no request was made. `"401"`: the server said so. */
  reason: "no-token" | "401";
  /** The 401's body (null for "no-token"), for a callback that words its own refusal. */
  body: unknown;
  /** True when this is already the retry: the call rejects whatever the callback answers. */
  retried: boolean;
};

export type UnauthorizedHandler = "reject" | ((ctx: UnauthorizedContext) => Promise<boolean>);

export type BearerClientOptions = {
  /** Where the backend is. A function is read on every call (an env value that changes). */
  baseUrl: string | (() => string);
  /**
   * The bearer to send, read on every call and again before the one retry. May be async, so an
   * app can refresh a token that is about to lapse before handing it over.
   */
  getToken: () => string | null | Promise<string | null>;
  /** The company to name in `X-Entity-Id`; sent only when it answers a non-empty id. */
  entityHeader?: () => string | null;
  /**
   * The sentence when a refusal's body has none fit to show: a fixed one (default
   * HOUSE_FALLBACK) or one per status (errorCopy's `statusFallback`).
   */
  fallback?: string | ((status: number) => string);
  onUnauthorized: UnauthorizedHandler;
};

export type BearerRequest = Omit<RequestInit, "body" | "headers"> & {
  /** Appended to the path (withQuery). */
  query?: Query;
  /** A JSON body: anything but undefined is serialised, with `Content-Type: application/json`. */
  body?: unknown;
  /** A multipart body; the browser sets its Content-Type and boundary. Not with `body`. */
  form?: FormData;
  /**
   * Extra headers. The client's Authorization and Accept win over these, and so does its
   * X-Entity-Id whenever it sends one.
   */
  headers?: HeadersInit;
  /**
   * The company for THIS call, instead of the client's `entityHeader` (minty-web names it per
   * call: the payer portal is person-scoped, a module page names its company). `""` or null
   * sends none.
   */
  entityId?: string | null;
};

export type BearerClient = {
  /** The parsed JSON answer (null for an empty body, the text for a non-JSON one). */
  json<T = unknown>(path: string, init?: BearerRequest): Promise<T>;
  /** A file answer (a receipt, an invoice PDF) as a Blob. Fails exactly as `json` does. */
  blob(path: string, init?: BearerRequest): Promise<Blob>;
  /**
   * The successful Response itself, unread - for a caller that needs its headers (a download's
   * `Content-Disposition`). Fails exactly as `json` does.
   */
  response(path: string, init?: BearerRequest): Promise<Response>;
};

const JSON_ACCEPT = "application/json";
const ANY_ACCEPT = "*/*";

export function createBearerClient(options: BearerClientOptions): BearerClient {
  const base = (): string => {
    const url = typeof options.baseUrl === "function" ? options.baseUrl() : options.baseUrl;
    return url.replace(/\/+$/, "");
  };

  const fallbackFor = (status: number): string => {
    const { fallback } = options;
    if (typeof fallback === "function") return fallback(status);
    return fallback ?? HOUSE_FALLBACK;
  };

  /** True to retry. Throws whatever the callback throws. */
  async function unauthorized(ctx: UnauthorizedContext): Promise<boolean> {
    const handler = options.onUnauthorized;
    if (handler === "reject") return false;
    const retry = await handler(ctx);
    return retry === true && !ctx.retried;
  }

  async function send(path: string, init: BearerRequest, accept: string): Promise<Response> {
    const { query, body, form, headers: extraHeaders, entityId: callEntityId, ...rest } = init;
    if (body !== undefined && form !== undefined) {
      throw new TypeError("A request takes a JSON `body` or a `form`, not both.");
    }

    let retried = false;
    for (;;) {
      const token = await options.getToken();
      if (!token) {
        if (await unauthorized({ path, reason: "no-token", body: null, retried })) {
          retried = true;
          continue;
        }
        throw new ApiError(401, SESSION_ENDED, null);
      }

      const headers = new Headers(extraHeaders);
      headers.set("Accept", accept);
      headers.set("Authorization", `Bearer ${token}`);
      const entityId = callEntityId !== undefined ? callEntityId : options.entityHeader?.();
      if (entityId) headers.set("X-Entity-Id", entityId);
      if (body !== undefined) headers.set("Content-Type", "application/json");

      const res = await fetch(`${base()}${withQuery(path, query)}`, {
        ...rest,
        headers,
        body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
      });

      if (res.status === 401) {
        const refusal = await readBody(res);
        if (await unauthorized({ path, reason: "401", body: refusal, retried })) {
          retried = true;
          continue;
        }
        throw new ApiError(401, SESSION_ENDED, null);
      }
      if (!res.ok) {
        const refusal = await readBody(res);
        throw new ApiError(res.status, errorSentence(refusal, fallbackFor(res.status)), refusal);
      }
      return res;
    }
  }

  return {
    async json<T = unknown>(path: string, init: BearerRequest = {}): Promise<T> {
      return (await readBody(await send(path, init, JSON_ACCEPT))) as T;
    },
    async blob(path: string, init: BearerRequest = {}): Promise<Blob> {
      return (await send(path, init, ANY_ACCEPT)).blob();
    },
    response(path: string, init: BearerRequest = {}): Promise<Response> {
      return send(path, init, ANY_ACCEPT);
    },
  };
}
