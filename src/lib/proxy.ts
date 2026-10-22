/**
 * The apps' proxy (Next 16's middleware) sending a browser to Minty (Flask) - the login-gated
 * re-handoff when a page has no token.
 *
 * A plain 307 redirect - except on a branch preview-set host (previewSibling's previewSetSlug),
 * where the trip has to START on a page of this host: a visitor arriving from a link on GitHub
 * or in an email makes the whole redirect chain cross-site, and Flask names a preview set only on
 * a same-site navigation (Minty blueprints/shared/preview_origin.py), so it would hand back to the
 * configured hub instead of the set. A meta refresh is navigated by the page itself.
 *
 * Merged from `toFlask` in minty-web's and minty-petty-cash-web's proxy.ts.
 */

import { NextResponse, type NextRequest } from "next/server";

import { previewSetSlug } from "./previewSibling";

const ATTRIBUTE_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  '"': "&quot;",
  "<": "&lt;",
  ">": "&gt;",
};

/** `value` safe inside a double-quoted HTML attribute. */
function escapeAttribute(value: string): string {
  return value.replace(/[&"<>]/g, (ch) => ATTRIBUTE_ESCAPES[ch]);
}

/** Send the browser to `url` (on Flask): a 307, or on a preview-set host a refreshing page. */
export function toFlask(request: NextRequest, url: string): NextResponse {
  if (previewSetSlug(request.nextUrl.host) === null) return NextResponse.redirect(url);
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${escapeAttribute(url)}"><title>Minty</title>`,
    {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    },
  );
}
