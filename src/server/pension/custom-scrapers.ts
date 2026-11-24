import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { Browser, CookieData, ElementHandle, Page } from "puppeteer";
import puppeteerVanilla from "puppeteer";
import { addExtra } from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type {
  PensionScrapeOutcome,
  ScrapePensionArgs,
} from "israeli-pension-scrapers";
import { dataDir } from "@/server/lib/data-dir";
import {
  extractPhoenixAccounts,
  parsePhoenixProductDetail,
  type PhoenixProductDetail,
  type PhoenixSavingItem,
  type RichPensionAccount,
} from "./parsers";

// puppeteer-extra's bundled types lag the installed puppeteer; the cast keeps the call site clean.
const puppeteer = addExtra(puppeteerVanilla as unknown as Parameters<typeof addExtra>[0]);
puppeteer.use(StealthPlugin());

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isContextDestroyedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Execution context was destroyed") ||
    msg.includes("Cannot find context with specified id") ||
    msg.includes("Target closed")
  );
}

async function saveDebugSnapshot(page: Page, fundId: string): Promise<string | null> {
  try {
    const dir = path.join(dataDir(), "pension-debug");
    fs.mkdirSync(dir, { recursive: true });
    const pngPath = path.join(dir, `${fundId}-error.png`);
    const htmlPath = path.join(dir, `${fundId}-error.html`);
    await page.screenshot({ path: pngPath, fullPage: true }).catch(() => {});
    const html = await page.content().catch(() => "");
    if (html) fs.writeFileSync(htmlPath, html, "utf8");
    return dir;
  } catch {
    return null;
  }
}

async function safeContent(page: Page): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await page.content();
    } catch (err) {
      if (!isContextDestroyedError(err) || attempt === 2) throw err;
      await delay(1000);
    }
  }
  return "";
}

async function launchStealthBrowser(headless: boolean): Promise<Browser> {
  const noSandbox =
    process.env.DISABLE_CHROMIUM_SANDBOX === "1" ||
    process.env.PENSION_SCRAPERS_NO_SANDBOX === "1";

  const args = [
    "--disable-blink-features=AutomationControlled",
    "--lang=he-IL",
    ...(noSandbox ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
    ...(headless ? [] : ["--window-size=1280,960"]),
  ];

  return (await puppeteer.launch({
    headless,
    defaultViewport: headless ? { width: 1280, height: 900 } : null,
    args,
  })) as unknown as Browser;
}

async function restoreSession(
  browser: Browser,
  args: ScrapePensionArgs,
): Promise<void> {
  if (!args.session || !args.connectionId) return;
  try {
    const cookies = await args.session.load(args.connectionId);
    if (cookies && cookies.length > 0) {
      await browser.setCookie(...(cookies as CookieData[]));
    }
  } catch {
    // Best effort: fall back to fresh login if stored cookies fail to apply.
  }
}

async function persistSession(
  browser: Browser,
  args: ScrapePensionArgs,
): Promise<void> {
  if (!args.session || !args.connectionId) return;
  try {
    const cookies = await browser.cookies();
    await args.session.save(args.connectionId, cookies);
  } catch {
    // Best effort.
  }
}

async function findFirstVisible(
  page: Page,
  selectors: string[],
  timeoutMs = 15000,
): Promise<ElementHandle<Element> | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      for (const sel of selectors) {
        const handles = await page.$$(sel);
        for (const h of handles) {
          const visible = await h
            .evaluate((el) => {
              const style = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                rect.width > 0 &&
                rect.height > 0
              );
            })
            .catch(() => false);
          if (visible) return h;
        }
      }
    } catch (err) {
      if (!isContextDestroyedError(err)) throw err;
    }
    await delay(250);
  }
  return null;
}

async function fillInput(
  page: Page,
  handle: ElementHandle<Element>,
  value: string,
): Promise<void> {
  await handle.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await handle.type(value, { delay: 20 });
  await handle
    .evaluate((el) => {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    })
    .catch(() => {});
}

async function clickButtonByText(
  page: Page,
  labels: string[],
  excludeLabels: string[] = [],
  anchor?: ElementHandle<Element> | null,
): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const handles = await page.$$('button, [role="button"], input[type="submit"]');
      const candidates: { handle: ElementHandle<Element>; inAnchorScope: boolean }[] = [];
      for (const handle of handles) {
        const info = await handle
          .evaluate(
            (el, wanted, excluded, anchorEl) => {
              const style = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              if (
                style.display === "none" ||
                style.visibility === "hidden" ||
                rect.width === 0 ||
                rect.height === 0 ||
                (el as HTMLButtonElement).disabled
              ) {
                return null;
              }
              const text = (
                el.textContent ||
                (el as HTMLInputElement).value ||
                ""
              ).trim();
              if (excluded.some((ex) => text.includes(ex))) return null;
              if (!wanted.some((w) => text.includes(w))) return null;

              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              const topEl = document.elementFromPoint(cx, cy);
              if (topEl && topEl !== el && !el.contains(topEl)) {
                return null;
              }

              let inScope = false;
              if (anchorEl) {
                const scope =
                  anchorEl.closest(
                    'app-pinfo-portal-mfa, [role="dialog"], dialog, form, .modal, [class*="modal"]',
                  ) || anchorEl.parentElement?.parentElement?.parentElement;
                inScope = Boolean(scope && scope.contains(el));
              }
              return { inScope };
            },
            labels,
            excludeLabels,
            anchor ?? null,
          )
          .catch(() => null);
        if (info) {
          candidates.push({ handle, inAnchorScope: info.inScope });
        }
      }
      const target =
        candidates.find((c) => c.inAnchorScope)?.handle ?? candidates[0]?.handle;
      if (target) {
        await target.click();
        return true;
      }
      return false;
    } catch (err) {
      if (!isContextDestroyedError(err) || attempt === 2) throw err;
      await delay(500);
    }
  }
  return false;
}

async function handleOtpStep(
  page: Page,
  args: ScrapePensionArgs,
  otpSelectors: string[],
  confirmLabels: string[],
  excludeConfirmLabels: string[] = [],
): Promise<void> {
  const deadline = Date.now() + 30000;
  let singleInput: ElementHandle<Element> | null = null;
  let digitBoxes: ElementHandle<Element>[] = [];

  while (Date.now() < deadline) {
    try {
      const boxes = await page.$$('input[maxlength="1"]');
      const visibleBoxes: ElementHandle<Element>[] = [];
      for (const box of boxes) {
        const vis = await box
          .evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          })
          .catch(() => false);
        if (vis) visibleBoxes.push(box);
      }
      if (visibleBoxes.length >= 4) {
        digitBoxes = visibleBoxes;
        break;
      }

      singleInput = await findFirstVisible(page, otpSelectors, 400);
      if (singleInput) break;
    } catch (err) {
      if (!isContextDestroyedError(err)) throw err;
    }
    await delay(300);
  }

  if (digitBoxes.length === 0 && !singleInput) {
    return;
  }

  if (!args.onOtpNeeded) {
    throw new Error("SMS verification code is required.");
  }

  args.onProgress?.("ממתין לקוד אימות SMS...");
  const otpCode = (await args.onOtpNeeded()).trim();

  if (digitBoxes.length >= 4) {
    for (let i = 0; i < Math.min(digitBoxes.length, otpCode.length); i++) {
      await fillInput(page, digitBoxes[i], otpCode[i]);
    }
  } else if (singleInput) {
    await fillInput(page, singleInput, otpCode);
  }

  await delay(300);
  const anchor = digitBoxes[0] ?? singleInput;
  const clicked = await clickButtonByText(
    page,
    confirmLabels,
    excludeConfirmLabels,
    anchor,
  );
  if (!clicked) {
    const submitBtn = await findFirstVisible(
      page,
      ['button[type="submit"]', 'input[type="submit"]'],
      1500,
    );
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press("Enter").catch(() => {});
    }
  }
}

async function scrapePhoenix(
  page: Page,
  args: ScrapePensionArgs,
): Promise<PensionScrapeOutcome> {
  const id = args.credentials.id ?? "";
  const phone = args.credentials.phone ?? "";

  args.onProgress?.("מתחבר לאזור האישי בהפניקס...");
  await page.goto("https://my.fnx.co.il/", {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await delay(2000);

  const idInput = await findFirstVisible(
    page,
    ['input[placeholder*="ת.ז"]', 'input[id*="id"]'],
    8000,
  );

  if (idInput) {
    if (id) await fillInput(page, idInput, id);

    if (phone) {
      const phoneInput = await findFirstVisible(
        page,
        ['input[placeholder*="טלפון"]', 'input[id*="phone"]'],
        3000,
      );
      if (phoneInput) await fillInput(page, phoneInput, phone);
    }

    const clicked = await clickButtonByText(page, [
      "שלחו לי קוד כניסה",
      "שלח קוד",
      "כניסה",
    ]);
    if (!clicked) {
      const submit = await findFirstVisible(
        page,
        ['button[type="submit"]'],
        3000,
      );
      if (submit) await submit.click();
    }

    args.onProgress?.("ממתין למסך קוד SMS...");
    await handleOtpStep(
      page,
      args,
      [
        'input[name*="otp"]',
        'input[id*="code"]',
        'input[name*="sms"]',
        'input[placeholder*="קוד"]',
        'input[autocomplete="one-time-code"]',
      ],
      ["המשך", "אישור", "כניסה"],
    );
  }

  args.onProgress?.("מחלץ יתרות חיסכון ופוליסות מהפניקס...");
  await page
    .waitForFunction(
      () =>
        !window.location.hostname.includes("auth.") &&
        (Boolean(document.querySelector("app-saving-item")) ||
          document.body?.innerText?.includes('סה"כ השקעות וחסכונות')),
      { timeout: 45000 },
    )
    .catch(() => {});
  await page
    .waitForNetworkIdle({ idleTime: 800, timeout: 10000 })
    .catch(() => {});
  await delay(2000);

  args.onProgress?.("עובר ללשונית השקעות וחסכונות בהפניקס...");
  const savingsLink = await findFirstVisible(page, ['a[href="/savings"]'], 5000);
  if (savingsLink) {
    await savingsLink.click().catch(() => {});
  } else {
    await page
      .goto("https://my.fnx.co.il/savings", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      })
      .catch(() => {});
  }

  await page
    .waitForFunction(
      () =>
        document.body?.innerText?.includes("פירוט מוצרים") ||
        document.body?.innerText?.includes("סכום חיסכון"),
      { timeout: 15000 },
    )
    .catch(() => {});
  await page
    .waitForNetworkIdle({ idleTime: 800, timeout: 10000 })
    .catch(() => {});
  await delay(1500);

  const productDetails = await page
    .evaluate(() => {
      const results: PhoenixProductDetail[] = [];
      const seenAcc = new Set<string>();
      const allEls = Array.from(document.querySelectorAll("div, section, article"));
      for (const el of allEls) {
        const text = (el.textContent || "").trim();
        if (!text.includes("מספר חשבון") || !text.includes("סכום חיסכון")) continue;
        if (el.querySelectorAll("div").length > 35) continue;
        const accMatch = text.match(/מספר חשבון\s*([0-9\-()\s]+)/);
        const accountNumber = accMatch?.[1]?.trim() || "";
        if (!accountNumber || seenAcc.has(accountNumber)) continue;
        seenAcc.add(accountNumber);

        let name = "";
        let cur: Element | null = el;
        for (let depth = 0; depth < 3 && cur && !name; depth++) {
          let prev: Element | null = cur.previousElementSibling;
          while (prev && !name) {
            const t = prev.textContent?.trim() || "";
            if (t && t.length < 60 && !t.includes("פירוט מוצרים")) name = t;
            prev = prev.previousElementSibling;
          }
          cur = cur.parentElement;
        }
        if (!name) {
          const parentHeading = el.closest("section, div")?.querySelector("h2, h3, h4");
          const ht = parentHeading?.textContent?.trim() || "";
          if (ht && ht.length < 60 && !ht.includes("פירוט מוצרים")) name = ht;
        }
        results.push({ name, accountNumber, text });
      }
      return results;
    })
    .catch(() => [] as PhoenixProductDetail[]);

  const richAccounts: RichPensionAccount[] = productDetails
    .map((item) => parsePhoenixProductDetail(item, id))
    .filter((a): a is RichPensionAccount => a !== null);

  if (richAccounts.length > 0) {
    return { success: true, accounts: richAccounts };
  }

  const savingItems = await page
    .evaluate(() => {
      const items: PhoenixSavingItem[] = [];
      for (const el of document.querySelectorAll("app-saving-item")) {
        const name = el.querySelector("h3 span, h3")?.textContent?.trim() || "";
        const accountNumber = el.querySelector('[dir="ltr"]')?.textContent?.trim() || "";
        const text = el.textContent || "";
        const m = text.match(/([₪$€]\s*[\d,]+(?:\.\d+)?)/);
        if (m) {
          items.push({ name, accountNumber, amount: m[1] });
        }
      }
      return items;
    })
    .catch(() => [] as PhoenixSavingItem[]);

  const htmlContent = await safeContent(page);
  const accounts = extractPhoenixAccounts(htmlContent, id, savingItems);

  if (accounts.length === 0) {
    const debugDir = await saveDebugSnapshot(page, "phoenix");
    console.error(`[pension:phoenix] no balance found at ${page.url()}${debugDir ? ` (debug saved to ${debugDir})` : ""}`);
    return {
      success: false,
      accounts: [],
      errorType: "SCRAPE_ERROR",
      errorMessage:
        "לא נמצאה יתרה בדף החשבון של הפניקס. ייתכן שההתחברות נכשלה או שמבנה הדף השתנה.",
    };
  }

  return { success: true, accounts };
}

/** Runs our custom Puppeteer scraper for Phoenix Investments. */
export async function scrapeCustomPension(
  args: ScrapePensionArgs,
): Promise<PensionScrapeOutcome> {
  const headless =
    args.headless ?? process.env.PENSION_SCRAPERS_HEADFUL !== "1";
  const browser = await launchStealthBrowser(headless);

  const page = await browser.newPage();
  try {
    await restoreSession(browser, args);
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({
      "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
    });

    const outcome = await scrapePhoenix(page, args);
    if (outcome.success) {
      await persistSession(browser, args);
    }
    return outcome;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const debugDir = await saveDebugSnapshot(page, args.fundId);
    console.error(`[pension:${args.fundId}] failed: ${msg}${debugDir ? ` (debug saved to ${debugDir})` : ""}`);
    return {
      success: false,
      accounts: [],
      errorType: "GENERAL_ERROR",
      errorMessage: msg,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
