import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Migration tests run every SQL file against a real DB; shared CI runners (Windows) need well over the 5s default.
    testTimeout: 60_000,
    coverage: {
      provider: "v8",
      // lcov feeds SonarQube (sonar.javascript.lcov.reportPaths); text-summary prints the gate result.
      reporter: ["text-summary", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      // The gate covers the layers this suite owns: pure logic and every server module
      // (routes, queries, scrapers, sync). React components are covered by e2e/, not here,
      // so counting them would only dilute the number.
      include: ["src/lib/**/*.{ts,tsx}", "src/server/**/*.{ts,tsx}", "src/proxy.ts"],
      exclude: ["src/**/*.d.ts"],
      // Floors that lock in the current suite. They sit just under the measured numbers:
      // raise them when coverage rises, never lower them to green a build.
      thresholds: {
        statements: 74,
        branches: 66,
        functions: 71,
        lines: 75,
        // The core that must not lose money or data gets its own floor per file, set to the
        // measured value rounded down (a ratchet). The target is 90 lines / 85 branches.
        "src/lib/money.ts": { statements: 76, branches: 44, functions: 40, lines: 75 },
        "src/server/lib/dedup.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
        "src/lib/sync-schedule.ts": { statements: 100, branches: 94, functions: 100, lines: 100 },
        "src/server/sync/**": { statements: 56, branches: 47, functions: 63, lines: 56 },
        "src/server/db/migrate.ts": { statements: 88, branches: 76, functions: 100, lines: 89 },
        // Measured 100 on some runs and 95/87 on most: one branch depends on test timing.
        "src/server/db/backup.ts": { statements: 95, branches: 87, functions: 100, lines: 100 },
        "src/server/lib/portable-backup.ts": {
          statements: 89,
          branches: 75,
          functions: 83,
          lines: 92,
        },
        "src/server/lib/encryption.ts": { statements: 84, branches: 78, functions: 91, lines: 85 },
        "src/proxy.ts": { statements: 96, branches: 91, functions: 100, lines: 97 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/server-only-stub.ts"),
    },
  },
});
