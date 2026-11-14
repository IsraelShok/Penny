import { expect, test } from "@playwright/test";

test.describe("core screens", () => {
  test("home shows the money tree seed on an empty account", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "עץ הכסף שלך" })).toBeVisible();
    await expect(page.getByRole("img", { name: /עץ הכסף שלך, בשלב זרע/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "לשתול" })).toHaveAttribute("href", "/investments");
  });

  test("no page scrolls sideways", async ({ page }) => {
    for (const path of ["/", "/learn", "/learn/electric-car", "/calculators", "/car", "/discounted-home", "/calculators/mortgage", "/calculators/debt"]) {
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("navigation", () => {
  test("the sidebar reaches the calculators hub through Tools", async ({ page, isMobile }) => {
    test.skip(isMobile, "the phone layout uses the bottom dock");
    await page.goto("/");
    await page.getByRole("link", { name: "כלים" }).first().click();
    await page.getByRole("link", { name: /^מחשבונים/ }).first().click();
    await expect(page).toHaveURL(/\/calculators$/);
    await expect(page.getByRole("link", { name: /משכנתא/ })).toBeVisible();
  });
});

test.describe("calculators", () => {
  test("car: switching car B to petrol makes both cars cost the same", async ({ page }) => {
    await page.goto("/car");
    await expect(page.getByText(/זול יותר ב/)).toBeVisible();
    const carB = page.getByRole("region", { name: "רכב ב׳" });
    await carB.getByRole("radio", { name: "בנזין" }).click();
    await carB.getByLabel("מחיר, ₪").fill("140000");
    await expect(page.getByText("שני הרכבים עולים בערך אותו דבר.")).toBeVisible();
  });

  test("mortgage: warns when everything is on prime", async ({ page }) => {
    await page.goto("/calculators/mortgage");
    await expect(page.getByText(/החזר חודשי ראשון/)).toBeVisible();
    for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "הסרה" }).last().click();
    await expect(page.getByLabel("חלק, %")).toHaveCount(1);
    await page.getByLabel("חלק, %").fill("100");
    await expect(page.getByText(/לפחות 33% מהמשכנתא/)).toBeVisible();
  });

  test("debt: a budget below the minimums asks for more", async ({ page }) => {
    await page.goto("/calculators/debt");
    await page.getByLabel(/כמה אפשר לשלם בחודש/).fill("500");
    await expect(page.getByText(/צריך להעלות את התקציב החודשי/)).toBeVisible();
  });

  test("discounted home shows a verdict", async ({ page }) => {
    await page.goto("/discounted-home");
    await expect(page.getByText(/משאירה אתכם במצב טוב יותר|בערך לאותו מקום/)).toBeVisible();
  });
});

test.describe("knowledge center", () => {
  test("search narrows the guides and a guide leads to its calculator", async ({ page }) => {
    await page.goto("/learn");
    await page.getByRole("searchbox", { name: "חיפוש מדריכים" }).fill("משכנתא");
    await expect(page.getByRole("link", { name: /תמהיל משכנתא/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /לצאת מהמינוס/ })).toHaveCount(0);
    await page.getByRole("link", { name: /תמהיל משכנתא/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "תמהיל משכנתא בלי כאב ראש" })).toBeVisible();
    await page.getByRole("link", { name: "מחשבון משכנתא" }).click();
    await expect(page).toHaveURL(/\/calculators\/mortgage$/);
  });
});

test.describe("profiles", () => {
  test("with two profiles, a new session starts at who's using, and picking one goes home", async ({ page, browser, isMobile }) => {
    test.skip(isMobile, "profiles are shared data; one project is enough");
    await page.goto("/profiles");
    await page.getByRole("button", { name: "הוספת פרופיל" }).click();
    await page.getByLabel("שם").fill("נועה");
    await page.getByRole("button", { name: /שמירה/ }).click();
    await expect(page.getByRole("button", { name: "נועה" })).toBeVisible();

    const fresh = await browser.newPage();
    await fresh.goto("/");
    await expect(fresh).toHaveURL(/\/profiles$/);
    await fresh.getByRole("button", { name: "נועה" }).click();
    await expect(fresh).toHaveURL(/\/$/);
    await fresh.close();
  });
});

test.describe("PWA", () => {
  test("serves an installable manifest and the offline page", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.name).toBe("Penny");
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
    expect((await request.get("/offline.html")).ok()).toBe(true);
    expect((await request.get("/sw.js")).headers()["cache-control"]).toContain("no-cache");
  });
});
