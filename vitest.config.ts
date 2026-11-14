import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Migration tests run every SQL file against a real DB; shared CI runners (Windows) need well over the 5s default.
  test: { include: ["tests/**/*.test.ts"], testTimeout: 60_000 },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/server-only-stub.ts"),
    },
  },
});
