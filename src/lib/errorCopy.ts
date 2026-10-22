/**
 * How a failure becomes something a person can read - the one guard every app runs a server's
 * words through before they reach a toast, a banner or a field message.
 *
 * The copy standard (Minty `docs/features/ERROR_MESSAGE_LEAKS.md`, minty-payment-request-web
 * `docs/ERROR_COPY.md`): under two sentences, first person, no codes, stack text, markup or
 * HTTP statuses in the visible string. Text that does not read as a sentence is replaced by the
 * caller's fallback - by default the house line - so a machine code never reaches a person.
 *
 * Merged from minty-payment-request-web's lib/api.ts (`readsAsProse`, `normalizeApiErrorDetail`,
 * `resolveApiErrorMessage`, `STATUS_FALLBACK_MESSAGES`) and minty-onboarding-web's
 * lib/errorCopy.ts (`RAW_ERROR_PATTERNS`, `errorCopy`, `friendlyError`). Where the two disagreed,
 * the stricter rule won (fewer raw strings reach people):
 *
 * - at most 200 characters (onboarding), not 300 (payment-request);
 * - a single word is refused (payment-request's "needs whitespace"), so "Forbidden" and
 *   "INVALID_STATE" no longer pass as onboarding let them;
 * - markup and braces are refused (payment-request); onboarding let "<html>" through;
 * - onboarding's raw patterns (`Failed to fetch`, `TypeError:`, `HTTP 502`, ...) apply
 *   everywhere; payment-request let "ValueError: bad input" through;
 * - payment-request's `null,` guard works (its regex held a stray backspace byte);
 * - a bare HTTP reason phrase ("Bad Gateway", "502 Bad Gateway") is refused on its own, not
 *   only when it equals `statusText` - which HTTP/2 never sends.
 */

/** Shown when nothing more specific can be said. Cause-neutral: it fires for unknown reasons. */
export const HOUSE_FALLBACK = "Something went wrong on my end. Mind trying again?";

/** Longer than this is a dump, not a sentence. */
export const MAX_PROSE_LENGTH = 200;

/**
 * Friendly copy for statuses whose server wording is unhelpful or absent. 422 is deliberately
 * absent: its body carries field detail callers surface inline, so a prose 422 passes through and
 * a machine-shaped one falls to the house line.
 */
export const STATUS_FALLBACK_MESSAGES: Readonly<Record<number, string>> = {
  403: "You don't have access to that.",
  404: "I couldn't find that.",
  408: "That took too long to come back. Mind trying again?",
  409: "Someone else changed that first. Refresh and try again.",
  429: "That's a lot of requests at once. Give it a moment and try again.",
  500: HOUSE_FALLBACK,
  502: "I couldn't reach the server just now. Mind trying again?",
  503: "The server is busy right now. Mind trying again in a moment?",
  504: "The server took too long to answer. Mind trying again?",
};

/** The copy for a status: its own line when there is one, otherwise the house line. */
export function statusFallback(status: number): string {
  return STATUS_FALLBACK_MESSAGES[status] ?? HOUSE_FALLBACK;
}

/** HTTP reason phrases that fall through as "messages" when a server has nothing to say. */
const REASON_PHRASES = new Set(
  [
    "bad request",
    "unauthorized",
    "payment required",
    "forbidden",
    "not found",
    "method not allowed",
    "not acceptable",
    "request timeout",
    "conflict",
    "gone",
    "payload too large",
    "content too large",
    "unsupported media type",
    "unprocessable entity",
    "unprocessable content",
    "too many requests",
    "internal server error",
    "not implemented",
    "bad gateway",
    "service unavailable",
    "gateway timeout",
  ].map((phrase) => phrase.toLowerCase()),
);

/** True when `text` is only an HTTP reason phrase, with or without its status code. */
function isReasonPhrase(text: string): boolean {
  const phrase = text
    .replace(/^\d{3}\s*/, "")
    .replace(/[.!]+$/, "")
    .trim()
    .toLowerCase();
  return REASON_PHRASES.has(phrase);
}

/**
 * Shapes that mean the text is machinery, not a sentence. Each is matched anywhere in the text
 * unless anchored.
 */
const RAW_ERROR_PATTERNS: readonly RegExp[] = [
  // markup, a serialised body or list, "[object Object]"
  /[{}[\]<>]/,
  // a stack, an exception, a dunder, a serialised null
  /traceback/i,
  /exception/i,
  /__/,
  /\bnull,/i,
  // what a browser or runtime says when the network or a parse fails
  /failed to fetch/i,
  /networkerror/i,
  /load failed/i,
  /unexpected token/i,
  /unexpected end of/i,
  /is not a function/i,
  /is not defined/i,
  /cannot read/i,
  // "Error: ...", "TypeError: ...", "ValueError: ..." at the start
  /^\w*error:/i,
  // an HTTP status: "HTTP 502", "http500", "HTTP/1.1 500", "status code 500"
  /\bhttp(?:\/[\d.]+)?\s*\d{3}\b/i,
  /\bstatus(?:\s+code)?\s*:?\s*\d{3}\b/i,
];

/**
 * True when `message` reads as a sentence a person can be shown: non-blank, at most
 * MAX_PROSE_LENGTH characters once trimmed, more than one word, not a bare lowercase code, not a
 * reason phrase, and free of every raw pattern above.
 */
export function readsAsProse(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > MAX_PROSE_LENGTH) return false;
  // A bare machine code (`invalid_state`, `bill.not_found`, `e:42`) is not a sentence.
  if (/^[a-z0-9_.:-]+$/.test(text)) return false;
  // Nor is a single word, whatever its case ("Forbidden", "INVALID_STATE", "ERR-1234").
  if (!/\s/.test(text)) return false;
  if (isReasonPhrase(text)) return false;
  return !RAW_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Flatten whatever a server put in an error field into one string, or `fallback`.
 *
 * - a string stands as it is;
 * - a list keeps its strings and each entry's pydantic `msg` (django-ninja answers a schema
 *   failure with `[{type, loc, msg}, ...]`), joined with "; ";
 * - an object is a field-error map (`{"email": ["This field is required."]}`): its string values
 *   are kept and the keys dropped;
 * - anything else - a number, a boolean, nothing readable - is `fallback`, never "[object
 *   Object]".
 *
 * Flattening is not approval: the result still goes through `readsAsProse`.
 */
export function normalizeApiErrorDetail(detail: unknown, fallback: string): string {
  if (detail === null || detail === undefined || detail === "") return fallback;
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const parts = detail
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object") {
          const msg = (entry as { msg?: unknown }).msg;
          if (typeof msg === "string") return msg;
        }
        return "";
      })
      .filter((part) => part.trim() !== "");
    return parts.length ? parts.join("; ") : fallback;
  }

  if (typeof detail === "object") {
    const parts = Object.values(detail as Record<string, unknown>)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((value): value is string => typeof value === "string")
      .filter((value) => value.trim() !== "");
    return parts.length ? parts.join("; ") : fallback;
  }

  return fallback;
}

/**
 * Make one server value fit to show, or fall back. Accepts whatever was sent - a string, a list,
 * a field map - flattens it (`normalizeApiErrorDetail`) and keeps it only when it reads as prose.
 * The result is trimmed. An empty or missing `fallback` means the house line.
 */
export function errorCopy(message: unknown, fallback?: string): string {
  const safe = fallback || HOUSE_FALLBACK;
  const text = normalizeApiErrorDetail(message, "").trim();
  return text && readsAsProse(text) ? text : safe;
}

/** The fields a backend's error body carries its sentence in, in the order they are read. */
const ERROR_FIELDS = ["error", "detail", "message"] as const;

/**
 * The sentence in a failed response's body, fit to show, or `fallback`.
 *
 * Reads `error` (Flask, the subscription API), then `detail` (Django), then `message` (the auth
 * endpoints): the FIRST field that flattens to non-empty text is the one judged - a machine code
 * in `error` is not rescued by a sentence in `message`. A body that is not an object (a text
 * page, nothing) is `fallback`.
 */
export function friendlyError(body: unknown, fallback?: string): string {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    for (const field of ERROR_FIELDS) {
      const text = normalizeApiErrorDetail((body as Record<string, unknown>)[field], "").trim();
      if (text) return errorCopy(text, fallback);
    }
  }
  return fallback || HOUSE_FALLBACK;
}

/**
 * The message for a failed response: the server's own `detail` when it reads as a sentence
 * (and is not just the response's `statusText`), otherwise the status's copy.
 */
export function resolveApiErrorMessage(status: number, detail: unknown, statusText = ""): string {
  const raw = normalizeApiErrorDetail(detail, "").trim();
  if (raw && raw !== statusText.trim() && readsAsProse(raw)) return raw;
  return statusFallback(status);
}
