/**
 * The document reader's rules, shared by every form that reads an attached document with the model
 * (owner, 2026-11-04): Petty Cash's Add New Expense reads a receipt, Payment Request's new-bill form
 * an invoice. Lifted from minty-petty-cash-web's `lib/expenseAi.ts` (Flask's `expense_ai.js` before
 * it) and made generic over a form's own fields; each app keeps its field rules and its words.
 *
 *   Reading      a document is attached and being read  -> a notice; the form stays usable
 *   Suggested    a value came back with `applied: true`  -> filled into an EMPTY field, marked
 *   Confirmed    the person changes the field            -> the marking goes, the field is theirs
 *   Blank        low band (`applied: false`)             -> never filled; at most a note offering it
 *   Failed       a started read did not answer usefully  -> one quiet line (`failureOf`)
 *   Off          the API says the reader is switched off -> nothing at all, for the session
 *
 * NEVER OVERWRITE THE PERSON: a field holding a value when the answer arrives is left alone, and the
 * document's different reading is only offered. One exception, by decision: a field still at the
 * form's own DEFAULT that the person has not touched (today's date, the default account) counts as
 * empty - `touched` records every field the person changed, even back to the same value.
 * SUBMIT IS NEVER BLOCKED: the read runs beside the form, and nothing is written until the person
 * saves (the API writes nothing either).
 */

export type Band = "high" | "medium" | "low";

/** One read field: the value, the model's confidence (0-1), its band, and whether to prefill. */
export type ReadField = { value: string; confidence: number; band: Band; applied: boolean };

/** What an extract route answers: suggestions, or null and a reason code. */
export type ExtractAnswer<S = Record<string, unknown>> = {
  suggestions: S | null;
  reason: string | null;
};

/** The reader is switched off (`*_ENABLED`) or not configured: say nothing, for the session. */
export const READER_OFF_REASONS: readonly string[] = ["disabled", "not_configured"];

/**
 * A started read that came back with nothing to offer - the quiet failure line's cases. `no_context`
 * (the company has no accounts or suppliers to choose from) is not a failure of the read: nothing.
 */
export const FAILURE_REASONS: readonly string[] = [
  "rate_limited",
  "file_too_large",
  "unsupported_file",
  "provider_error",
  "timeout",
  "safety_blocked",
  "truncated",
  "invalid_reply",
  "no_usable_field",
];

/** The answer as data this side trusts the shape of, or null (anything else is "no suggestions"). */
export function suggestionsOf<S = Record<string, unknown>>(answer: unknown): S | null {
  if (!answer || typeof answer !== "object") return null;
  const s = (answer as { suggestions?: unknown }).suggestions;
  return s && typeof s === "object" ? (s as S) : null;
}

/**
 * Whether an answer with no suggestions is a failure the person is told about (one quiet line),
 * rather than silence (switched off, nothing to choose from). An answer WITH suggestions is never a
 * failure here: whether it showed anything is the form's to say (`useDocumentReader`'s
 * `onSuggestions` returns it) - a low-band reading offered as a note is not "couldn't read".
 */
export function failureOf(answer: unknown): boolean {
  if (suggestionsOf(answer)) return false;
  const reason = (answer as { reason?: unknown } | null)?.reason;
  return typeof reason !== "string" || FAILURE_REASONS.includes(reason);
}

// ---------------------------------------------------------------------------------------------
// The session latch

export type ReaderLatch = {
  /** Whether the reader has said it is off in this browser session (tab). */
  readerOff(): boolean;
  /** Notes an answer: an off reason switches the reader off for the session. */
  noteAnswer(answer: { reason?: string | null } | null): void;
  /** Tests only: forget the in-memory latch. */
  reset(): void;
};

/**
 * The app can't know in advance whether the reader is switched on (the API's setting): it learns
 * from a `disabled` answer and then gets out of the way for the rest of the session. One latch per
 * reader (`key` in sessionStorage), so a receipt reader's switch never silences an invoice reader.
 */
export function createReaderLatch(key: string): ReaderLatch {
  let latched = false;
  return {
    readerOff() {
      if (latched) return true;
      try {
        return sessionStorage.getItem(key) === "off";
      } catch {
        // Storage can be blocked (private mode, site data off): the in-memory latch still holds.
        return false;
      }
    },
    noteAnswer(answer) {
      if (!answer?.reason || !READER_OFF_REASONS.includes(answer.reason)) return;
      latched = true;
      try {
        sessionStorage.setItem(key, "off");
      } catch {
        // As above: the in-memory latch is enough for this page's life.
      }
    },
    reset() {
      latched = false;
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Nothing stored to forget.
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The form's state around its own values

/** A note under a field: the document reads something else (or, low band, might). Nothing moves without its button. */
export type ReadNote<V> = { text: string; fill: Partial<V>; band: Band };

export type ReaderState<V, F extends string> = {
  values: V;
  /** Fields holding an untouched suggestion, by band. */
  marks: Partial<Record<F, Band>>;
  notes: Partial<Record<F, ReadNote<V>>>;
  /** Fields the person has changed (even back to the same value): never treated as defaults. */
  touched: Partial<Record<F, true>>;
  /** A supplier name read off the document that is not on the list - offered for New Supplier. */
  detectedName: string | null;
  /** The one polite announcement of what the reading did ("" for nothing). */
  announcement: string;
};

/** What a form tells the rules about its own fields. */
export type ReaderSpec<V, F extends string> = {
  /** A field's values after Clear (or after its document is replaced): a blank - or its default. */
  cleared: (field: F) => Partial<V>;
  /** Two values that mean the same (an amount grouped on blur): an edit that is no change. */
  same?: (field: F, before: V, after: V) => boolean;
  /**
   * A form with defaults: re-picking a field's current value still counts as touching it, so a
   * default the person confirmed is never replaced. Without defaults, the same value is no change.
   */
  touchOnSame?: boolean;
};

export function readerState<V, F extends string>(values: V): ReaderState<V, F> {
  return { values, marks: {}, notes: {}, touched: {}, detectedName: null, announcement: "" };
}

/**
 * The person changed a field: it is theirs now (Confirmed) - touched, its marking and its note go,
 * and for `supplierField` the offered name too. A change to the same value is no change; one the
 * form calls the same (`spec.same`) keeps the marking.
 */
export function edited<V, F extends string>(
  state: ReaderState<V, F>,
  field: NoInfer<F>,
  patch: Partial<V>,
  spec: ReaderSpec<V, F>,
  supplierField?: NoInfer<F>,
): ReaderState<V, F> {
  const values = { ...state.values, ...patch };
  const changed = (Object.keys(patch) as (keyof V)[]).some((k) => patch[k] !== state.values[k]);
  const touched = { ...state.touched, [field]: true as const };
  if (!changed) return spec.touchOnSame && !state.touched[field] ? { ...state, touched } : state;
  if (spec.same?.(field, state.values, values)) return { ...state, values, touched };
  const marks = { ...state.marks };
  const notes = { ...state.notes };
  delete marks[field];
  delete notes[field];
  return {
    ...state,
    values,
    marks,
    notes,
    touched,
    detectedName: field === supplierField ? null : state.detectedName,
  };
}

/** Clear: a suggested field goes back to blank or its default, unmarked (only for a field still marked). */
export function cleared<V, F extends string>(
  state: ReaderState<V, F>,
  field: NoInfer<F>,
  spec: ReaderSpec<V, F>,
): ReaderState<V, F> {
  if (!state.marks[field]) return state;
  const marks = { ...state.marks };
  delete marks[field];
  return { ...state, values: { ...state.values, ...spec.cleared(field) }, marks };
}

/** "Use the value from the document": the note's value goes in, marked as suggested. */
export function usedNote<V, F extends string>(
  state: ReaderState<V, F>,
  field: NoInfer<F>,
): ReaderState<V, F> {
  const note = state.notes[field];
  if (!note) return state;
  const notes = { ...state.notes };
  delete notes[field];
  return {
    ...state,
    values: { ...state.values, ...note.fill },
    marks: { ...state.marks, [field]: note.band },
    notes,
  };
}

/** The offered supplier name was taken to New Supplier (or set aside): the offer goes. */
export function withoutDetectedName<V, F extends string>(
  state: ReaderState<V, F>,
): ReaderState<V, F> {
  return state.detectedName === null ? state : { ...state, detectedName: null };
}

/**
 * Another document (or none): the old one's suggestions go entirely - the VALUES of fields still
 * marked too (back to blank or default), or the never-overwrite rule would protect stale
 * suggestions as if typed. Fields the person changed are unmarked already and stay as they are.
 */
export function withoutSuggestions<V, F extends string>(
  state: ReaderState<V, F>,
  spec: ReaderSpec<V, F>,
): ReaderState<V, F> {
  let values = { ...state.values };
  for (const field of Object.keys(state.marks) as F[])
    values = { ...values, ...spec.cleared(field) };
  return { ...state, values, marks: {}, notes: {}, detectedName: null, announcement: "" };
}

/**
 * Whether a suggestion may fill `field`: it is empty, or it still holds the form's default and the
 * person has not touched it. (`isBlank` is the form's own idea of an empty value.)
 */
export function fillable<V, F extends string>(
  state: ReaderState<V, F>,
  field: NoInfer<F>,
  isBlank: boolean,
  atDefault = false,
): boolean {
  return isBlank || (atDefault && !state.touched[field]);
}

// ---------------------------------------------------------------------------------------------
// The copy that is sent

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

/**
 * A photo resized in the browser before it is read: a phone photo is 8-12 MB, and 2000px on the
 * long edge is plenty to read a document. THIS COPY IS FOR READING ONLY - saving still sends the
 * untouched original (stored exactly as uploaded, owner 2026-11-04). A PDF, a small photo, or a
 * browser without the canvas APIs gets the file itself back; so does any failure.
 */
export async function readingCopy(file: File): Promise<Blob> {
  if (!/^image\/(jpe?g|png)$/i.test(file.type)) return file;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    // Only when it is actually smaller: a tiny detailed image can re-encode larger.
    return blob && blob.size < file.size ? blob : file;
  } catch {
    // Unsupported, out of memory, a browser quirk: the original goes, and the server shrinks it.
    return file;
  }
}
