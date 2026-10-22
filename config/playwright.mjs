// Every Minty Next.js app's Playwright setup: one worker against a stack that is ALREADY UP
// (nothing is started here - see each app's e2e/README.md), traces and screenshots on failure.
//
//   import { mintyPlaywright } from "@minty/shared/playwright";
//   export default mintyPlaywright({ port: 3010, phone: true });
//
// Plain .mjs: Playwright will not strip types from a file under node_modules.
import { defineConfig, devices } from "@playwright/test";

/** The phone the suites check at: the 360px floor of the responsive rules (CLAUDE.md). */
export const PHONE = { width: 360, height: 740 };

/**
 * @param {{
 *   port: number,               // the app's local dev port; E2E_BASE_URL overrides it
 *   baseURL?: string,           // a fixed base instead of E2E_BASE_URL / the port
 *   testDir?: string,           // default "./e2e"
 *   testMatch?: string[],
 *   timeout?: number,           // default 45s
 *   desktopName?: string,       // default "chromium"
 *   phone?: boolean,            // also run every spec at PHONE (project "phone")
 * }} options
 */
export function mintyPlaywright(options) {
  const projects = [
    { name: options.desktopName ?? "chromium", use: { ...devices["Desktop Chrome"] } },
  ];
  if (options.phone) {
    projects.push({
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: PHONE, isMobile: true, hasTouch: true },
    });
  }
  return defineConfig({
    testDir: options.testDir ?? "./e2e",
    ...(options.testMatch ? { testMatch: options.testMatch } : {}),
    testIgnore: ["node_modules/**", ".next/**"],
    workers: 1,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: [["list"]],
    timeout: options.timeout ?? 45_000,
    expect: { timeout: 10_000 },
    use: {
      baseURL: options.baseURL ?? (process.env.E2E_BASE_URL || `http://localhost:${options.port}`),
      trace: "retain-on-failure",
      screenshot: "only-on-failure",
      video: "off",
    },
    projects,
  });
}
