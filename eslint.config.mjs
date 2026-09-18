import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Playwright fixtures take a `use` parameter (its own
    // provide-a-value-to-the-test convention) — nothing to do with
    // React's `use()` hook, but eslint-config-next's react-hooks rules
    // apply to every .ts file project-wide and can't tell the two
    // apart by name alone. e2e/ has no React code in it at all.
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);

export default eslintConfig;
