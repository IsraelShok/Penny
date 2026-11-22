import { expect, test } from "@playwright/test";

// Passkey unlock end to end, with Chrome's virtual authenticator (PRF on). Runs on
// localhost, because WebAuthn rejects a numeric RP id such as 127.0.0.1.
const BASE = `http://localhost:${process.env.PENNY_E2E_PORT ?? 3100}`;
const PASS = "e2e passphrase";

test.describe("passkey unlock", () => {
  test.skip(({ isMobile }) => isMobile, "one browser is enough");

  test.afterEach(async ({ page }) => {
    // Leave the shared test server unlocked for the other specs.
    await page.request.post(`${BASE}/api/lock`, {
      headers: { origin: BASE },
      data: { action: "disable", current: PASS },
    });
  });

  test("register a passkey, lock, unlock with it; recovery code shown at setup", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        hasPrf: true,
        automaticPresenceSimulation: true,
      },
    });

    await page.goto(`${BASE}/settings/privacy`);
    await page.locator("#lock-secret").fill(PASS);
    await page.getByRole("button", { name: "הפעלת נעילה" }).click();
    await expect(page.getByTestId("recovery-code")).toHaveText(/^[0-9A-Z]{5}(-[0-9A-Z]{5}){4}$/);

    await page.locator("#lock-current").fill(PASS);
    await page.getByRole("button", { name: "הוספת מפתח גישה" }).click();
    await expect(page.getByText("מפתח גישה 1 (localhost)")).toBeVisible();

    await page.evaluate(() =>
      fetch("/api/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lock" }),
      }),
    );
    await page.goto(`${BASE}/settings/privacy`);
    await expect(page).toHaveURL(/\/lock/);
    await page.getByRole("button", { name: "פתיחה עם מפתח גישה" }).click();
    await expect(page).toHaveURL(/\/settings\/privacy/);
    await expect(page.getByText("מפתח גישה 1 (localhost)")).toBeVisible();
  });
});
