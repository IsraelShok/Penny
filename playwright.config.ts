import { defineConfig, devices } from "@playwright/test";

// PENNY_E2E_PORT: run beside another checkout's test server.
const SHARED_STATE = /(profiles|passkey)\.spec\.ts$/;
const PORT = Number(process.env.PENNY_E2E_PORT ?? 3100);

// Runs against a production server with its own empty data folder, so tests never touch your real database.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // System Chrome, so no browser download is needed; CI can switch to bundled Chromium.
    channel: process.env.CI ? undefined : "chrome",
    locale: "he-IL",
    trace: "retain-on-failure",
  },
  // Tests that change shared data (a second profile, the app lock) run last and alone, so they
  // can't send the other tests to the profile picker or the lock screen.
  projects: [
    {
      name: "desktop",
      testIgnore: SHARED_STATE,
      use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" },
    },
    {
      name: "mobile",
      testIgnore: SHARED_STATE,
      use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "chrome" },
    },
    {
      name: "lock",
      testMatch: /passkey\.spec\.ts$/,
      dependencies: ["desktop", "mobile"],
      use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" },
    },
    {
      name: "profiles",
      testMatch: /profiles\.spec\.ts$/,
      dependencies: ["lock"],
      use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" },
    },
  ],
  webServer: {
    // A production build: dev mode recompiles and reloads pages mid-test.
    command: `node -e "require('fs').rmSync('e2e/.data', { recursive: true, force: true })" && npx next build && npx next start -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: { PENNY_DATA_DIR: "e2e/.data", PENNY_UPDATE_CHECK: "0" },
  },
});
