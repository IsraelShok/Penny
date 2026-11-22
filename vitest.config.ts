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
