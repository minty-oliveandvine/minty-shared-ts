// Every Minty Next.js app's next.config defaults. An app's next.config.ts:
//
//   import { withMintyDefaults } from "@minty/shared/next";
//   export default withMintyDefaults({ env: { ... }, ...its own });
//
// Plain .mjs: Next loads its config before it can transpile anything under node_modules.

/**
 * Sent with every response (the URL security round, 2026-10-05). Keep in step with Flask
 * (Minty pettycash/core/http_hardening.py).
 * - Referrer-Policy same-origin: another site never sees a path or query from here (tokens).
 * - frame-ancestors / X-Frame-Options: only this app may frame its pages (clickjacking).
 * - HSTS in production builds only; a browser ignores it over plain http anyway.
 */
export function securityHeaders(nodeEnv = process.env.NODE_ENV) {
  return [
    { key: "Referrer-Policy", value: "same-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    ...(nodeEnv === "production"
      ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
      : []),
  ];
}

/**
 * The app's config plus: @minty/shared compiled from source (it ships .ts), the security headers
 * on every path (before the app's own headers), no X-Powered-By, and 127.0.0.1 allowed as a dev
 * origin. The app's own keys win, except that its transpilePackages and headers are added to.
 *
 * @template {import("next").NextConfig} T
 * @param {T} config
 * @returns {T}
 */
export function withMintyDefaults(config = /** @type {T} */ ({})) {
  const own = config.headers;
  return {
    poweredByHeader: false,
    allowedDevOrigins: ["127.0.0.1"],
    ...config,
    transpilePackages: Array.from(new Set(["@minty/shared", ...(config.transpilePackages ?? [])])),
    async headers() {
      return [{ source: "/:path*", headers: securityHeaders() }, ...(own ? await own() : [])];
    },
  };
}
