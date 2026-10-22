// Every Minty Next.js app's Vitest setup. An app's vitest.config.ts:
//
//   import { mintyVitest } from "@minty/shared/vitest";
//   export default mintyVitest(import.meta.url, { exclude: ["public/**"] });
//
// Plain .mjs: Vitest loads its config through Node, which will not strip types under node_modules.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * @param {string} configUrl the app config's `import.meta.url` - the `@` alias points at its folder
 * @param {{ exclude?: string[], setupFiles?: string[] }} [options] extra excludes (on top of
 *   node_modules, .next and the Playwright folders) and setup files (default ./test/setup.ts)
 */
export function mintyVitest(configUrl, options = {}) {
  const root = dirname(fileURLToPath(configUrl));
  return defineConfig({
    esbuild: { jsx: "automatic" },
    // Mirrors the `@/*` -> `./*` mapping in each app's tsconfig.json.
    resolve: { alias: { "@": root } },
    test: {
      // Vitest does not read next.config's transpilePackages: @minty/shared is .ts source in
      // node_modules, so it must be transformed here rather than externalised.
      server: { deps: { inline: ["@minty/shared"] } },
      environment: "jsdom",
      setupFiles: options.setupFiles ?? ["./test/setup.ts"],
      include: ["**/*.test.ts", "**/*.test.tsx"],
      exclude: ["node_modules/**", ".next/**", "e2e/**", "**/e2e/**", ...(options.exclude ?? [])],
      // Explicit imports from "vitest" in every test file: globals would need a matching "types"
      // entry in tsconfig, and every app type-checks its tests.
      globals: false,
      clearMocks: true,
      restoreMocks: true,
    },
  });
}
