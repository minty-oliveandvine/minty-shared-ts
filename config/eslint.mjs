// Every Minty Next.js app's ESLint base: next/core-web-vitals + typescript, and the folders no app
// lints. An app spreads it first and adds only its own rules:
//
//   import { defineConfig } from "eslint/config";
//   import minty from "@minty/shared/eslint";
//   export default defineConfig([...minty, { ...its own rules }]);
//
// Plain .mjs, not .ts: ESLint loads its config with Node, which will not strip types from a file
// under node_modules. eslint-config-next is the app's own dependency (resolved from the app).
import { globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const minty = [
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/pdfjs/**"]),
];

export default minty;
