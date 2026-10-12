// Unit and component tests. There are no Playwright specs here: a browser journey belongs to the
// app that owns the page, so each consumer's e2e suite covers the sidebar in its own chrome.
//
//   npm test          once, no browser - the per-commit gate
//   npm run test:watch

import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules/**"],
    // Explicit imports from 'vitest' in every test file instead. Globals would need a matching
    // "types" entry in tsconfig, and the repo type-checks its tests.
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
