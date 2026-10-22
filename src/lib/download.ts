/**
 * Handing the browser a file the API answered - an invoice's PDF, a billing breakdown or a
 * report export as CSV - and the file name the server gave it.
 *
 * The save is a hidden `<a download>` over an object URL, put in the page only for the click and
 * removed after it (also when the click throws), so a bearer-read file is saved without a new
 * tab. The URL is revoked on the next tick: revoking at once cancels the download in some
 * browsers. Browser-only.
 *
 * Merged from minty-web's features/subscription/lib/download.ts (saveTextFile and its BOM) and
 * minty-petty-cash-web's lib/download.ts (saveBlob(blob, name), attachmentName).
 */

/** Hand `blob` to the browser as a download named `filename` (used exactly as given). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** The byte-order mark that makes Excel read a CSV as UTF-8 (a company named in Chinese). */
const UTF8_BOM = "﻿";

/**
 * Hand `text` to the browser as a file named `filename`, prefixed with a UTF-8 byte-order mark -
 * without it Excel opens a non-Latin company name as mojibake. A CSV unless `type` says otherwise.
 */
export function saveTextFile(
  text: string,
  filename: string,
  type: string = "text/csv;charset=utf-8",
): void {
  saveBlob(new Blob([UTF8_BOM, text], { type }), filename);
}

/** RFC 6266 / 5987's `filename*=UTF-8'<language>'<percent-encoded>`; other charsets are skipped. */
const EXTENDED_NAME = /(?:^|[;\s])filename\*\s*=\s*utf-8'[a-z0-9-]*'([^;]+)/i;

/** The plain `filename=`, quoted (which may hold a ";") or bare. */
const PLAIN_NAME = /(?:^|[;\s])filename\s*=\s*(?:"([^"]*)"|([^;]+))/i;

/**
 * The file name a `Content-Disposition` header gives (`attachment; filename=...`): the UTF-8
 * `filename*` first, then the plain `filename` (also when `filename*` is malformed). Only the
 * last path segment is kept - split on "/" AND "\" - so a name can never point into a folder.
 * Null when the header names nothing usable.
 */
export function filenameFromDisposition(header: string | null | undefined): string | null {
  if (!header) return null;
  let name: string | null = null;
  const extended = EXTENDED_NAME.exec(header);
  if (extended) {
    try {
      name = decodeURIComponent(extended[1].trim());
    } catch {
      name = null; // a malformed escape: the plain parameter decides
    }
  }
  if (!name) {
    const plain = PLAIN_NAME.exec(header);
    name = plain ? (plain[1] ?? plain[2] ?? "") : null;
  }
  const base = name?.split(/[\\/]/).pop()?.trim();
  return base ? base : null;
}
