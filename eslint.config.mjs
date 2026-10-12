// Next's own rules, because everything here is consumed by Next apps and compiled by their
// toolchain: the same lint that would run on these files in minty-web runs on them here.
//
// No `eslint-plugin-boundaries`: the consumers' boundary rules are about THEIR app's folders.
// This package's shape is enforced by its `exports` map (no root barrel) and by there being no
// `@/` alias to reach through - see the README.

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores(["node_modules/**"]),
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // There is no `pages/` or `app/` here to check against - this is a library, and the rule
      // prints a warning on every run looking for one. The consumers still apply it to their own
      // pages, which is where an <a> to an internal route would actually be wrong.
      "@next/next/no-html-link-for-pages": "off",
      // A packaged component must not reach for an app's module by alias or by climbing out of
      // src/ - it asks the host instead. Both would resolve in this repo and fail in a consumer.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/*"],
              message:
                "No `@/` alias here: tsconfig paths do not apply inside node_modules. Use a relative import, or ask the host (src/host.ts).",
            },
          ],
        },
      ],
    },
  },
]);
