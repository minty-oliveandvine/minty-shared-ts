// What every Minty app's Playwright suite needs to get in: a hand-off token signed with Minty's
// SECRET_KEY (E2E_JWT_SECRET), the credentials it names, and the sideways-scroll check. Each app's
// e2e/helpers.ts imports these and keeps only its own page helpers.
//
// Plain .mjs: Playwright will not strip types from a file under node_modules (the reason
// e2e/companyRef.ts was once a copy in every suite). Runs in Node, never in a browser.
import { createHmac } from "node:crypto";

export { companyRef, shortIdOf, slugifyName } from "./companyRef.mjs";

const b64url = (input) =>
  Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/**
 * The suite's identity from the environment, or null when any of the three is unset (a spec that
 * needs it skips). The company name defaults to the seed's "E2E Petty Cash Shop".
 */
export function credentials() {
  const secret = process.env.E2E_JWT_SECRET;
  const userId = process.env.E2E_MINTY_USER;
  const entityId = process.env.E2E_MINTY_ENTITY;
  if (!secret || !userId || !entityId) return null;
  return {
    secret,
    userId,
    entityId,
    entityName: process.env.E2E_MINTY_ENTITY_NAME || "E2E Petty Cash Shop",
  };
}

/** credentials(), or a loud failure naming what to set. */
export function requireCredentials() {
  const creds = credentials();
  if (!creds) {
    throw new Error(
      "Set E2E_JWT_SECRET (Minty SECRET_KEY), E2E_MINTY_USER and E2E_MINTY_ENTITY (see e2e/README.md)",
    );
  }
  return creds;
}

/** The module hand-off token Flask mints, signed HS256 with the shared key; 30 minutes. */
export function mintModuleToken(creds, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      user_id: creds.userId,
      entity_id: creds.entityId,
      xero_org_id: "",
      role: "admin",
      system_role: "normal",
      module: "billing",
      sid: "e2e",
      billing_enabled: true,
      petty_cash_enabled: true,
      exp: now + 1800,
      iat: now,
      ...overrides,
    }),
  );
  const signature = createHmac("sha256", creds.secret)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${payload}.${signature}`;
}

/** A token with a real shape and a wrong signature - what a forged or stale cookie looks like. */
export function forgedToken() {
  return mintModuleToken({ secret: "not-the-shared-key", userId: "nobody", entityId: "" });
}

/** True when the URL answers below 500 within the timeout (a redirect counts). */
export async function reachable(url, timeoutMs = 4000) {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    return res.status > 0 && res.status < 500;
  } catch {
    return false;
  }
}

/** No page may scroll sideways at any width (CLAUDE.md, Responsive UI rules). */
export async function expectNoSideScroll(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 0) throw new Error(`the page scrolls sideways by ${overflow}px`);
}
