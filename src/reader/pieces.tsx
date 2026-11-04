/**
 * The document reader's pieces in the classic look (every app's `main`/`development`): the teal
 * "Reading..." box, the line under a suggested field with Clear, the grey note offering a different
 * reading, and the one quiet failure line. Lifted from minty-petty-cash-web's ReceiptReader.tsx
 * (Flask's classic page before it); the colours are its theme's, as hex, so every app draws them
 * the same with no tokens. Each app passes its own words. Text read off a document is drawn as
 * text, never as markup.
 */

/** The ring on a field holding an untouched suggestion (Flask: `ring-2 ring-[#54D3DA] ring-offset-1`). */
export const SUGGESTED_RING = "ring-2 ring-[#54D3DA] ring-offset-1";

/** While the document is read (QA found 12px grey text was missed; the wait is seconds). */
export function ReadingNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div
      role="status"
      className="mb-1 mt-3 flex items-center gap-3 rounded-[12px] border border-[#54D3DA] bg-[#54D3DA]/10 px-4 py-3"
    >
      <svg
        className="h-5 w-5 shrink-0 animate-spin text-[#31B6BD]"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#31B6BD]">{title}</p>
        <p className="text-xs text-[#6B7280]">{detail}</p>
      </div>
    </div>
  );
}

/**
 * Under a suggested field: the sparkle, the app's "<Field> suggested" text, and Clear. Its id goes
 * in the field's aria-describedby, so the line is read with the field.
 */
export function SuggestedLine({
  id,
  text,
  clearLabel,
  onClear,
}: {
  id: string;
  text: string;
  clearLabel: string;
  onClear: () => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-sm text-[#31B6BD]">
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l2.4 6.2L21 10l-6.6 1.8L12 18l-2.4-6.2L3 10l6.6-1.8L12 2z" />
      </svg>
      <span id={id}>{text}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={clearLabel}
        className="min-h-11 min-w-11 cursor-pointer font-medium underline hover:no-underline"
      >
        Clear
      </button>
    </div>
  );
}

/** The grey note with one action: the document reads something else, or names an unknown supplier. */
export function ReaderNote({
  text,
  action,
  onAction,
}: {
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="mt-2 rounded-[8px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-sm">
      <p className="break-words text-[#4B5563]">{text}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-1 min-h-11 cursor-pointer break-words text-left font-medium text-[#31B6BD] underline hover:no-underline"
      >
        {action}
      </button>
    </div>
  );
}

/**
 * The one quiet failure line (owner, 2026-11-04): a started read came back with nothing - Part 11's
 * issue then action, e.g. "I couldn't read this receipt. Enter the details yourself." Polite, never
 * an alert: the form works as it did.
 */
export function ReadFailedLine({ text }: { text: string }) {
  return (
    <p role="status" className="mb-1 mt-3 break-words text-sm text-[#4B5563]">
      {text}
    </p>
  );
}
