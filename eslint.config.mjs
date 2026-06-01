import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "**/.next/**",
    "out/**",
    "**/out/**",
    "build/**",
    "**/build/**",
    "dist/**",
    "**/dist/**",
    "coverage/**",
    "**/coverage/**",
    "playwright-report/**",
    "**/playwright-report/**",
    "test-results/**",
    "**/test-results/**",
    "next-env.d.ts",
    "**/next-env.d.ts",
    "node_modules/**",
    "**/node_modules/**"
  ]),
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off"
    }
  }
]);

export default eslintConfig;
