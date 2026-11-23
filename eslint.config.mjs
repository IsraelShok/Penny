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
    // Worktrees and local tool output, not project code.
    ".claude/**",
    ".playwright-mcp/**",
    "dist-desktop/**",
    ".std/**",
    "coverage/**",
  ]),
  // A leading underscore marks a value dropped on purpose.
  { rules: { "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }] } },
  // The UTC day is the wrong "today" for two or three hours every night in Israel.
  {
    files: ["src/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='slice'][arguments.0.value=0][arguments.1.value=10][callee.object.callee.property.name='toISOString']",
          message:
            "Use israelToday() for the current day, israelDay(value) for a stored instant, or utcDay(date) for a date built in UTC (src/lib/dates.ts).",
        },
      ],
    },
  },
  // Electron entry points are CommonJS by design.
  { files: ["**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
]);

export default eslintConfig;
