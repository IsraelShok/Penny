import "server-only";

import fs from "node:fs";
import os from "node:os";
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
  parseExcellenceRows,
  parseExcellenceSummary,
  readSpreadsheetRows,
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
                    '[role="dialog"], dialog, form, .modal, [class*="modal"]',
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

async function scrapeExcellence(
  page: Page,
  args: ScrapePensionArgs,
): Promise<PensionScrapeOutcome> {
  const creds = args.credentials as { username?: string; password?: string };
  const username = creds.username ?? "";
  const password = creds.password ?? "";

  args.onProgress?.("מתחבר לאקסלנס טרייד...");
  await page.goto("https://extradepro.xnes.co.il/app", {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await delay(2000);

  const userInput = await findFirstVisible(
    page,
    ['#login-input', 'input[name="login"]'],
    8000,
  );
  if (userInput) {
    if (username) await fillInput(page, userInput, username);
    const passInput = await findFirstVisible(
      page,
      ['#password-input', 'input[name="password"]', 'input[type="password"]'],
      5000,
    );
    if (passInput && password) await fillInput(page, passInput, password);

    const submitBtn = await findFirstVisible(
      page,
      ['button.confirm-button[type="submit"]', 'button[type="submit"]'],
      3000,
    );
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await clickButtonByText(page, ["כניסה"]);
    }

    await handleOtpStep(
      page,
      args,
      [
        'input[name*="otp"]',
        'input[name*="code"]',
        'input[placeholder*="קוד"]',
        'input[autocomplete="one-time-code"]',
      ],
      ["המשך", "אישור", "כניסה"],
    );
  }

  args.onProgress?.("ממתין לטעינת תיק ההשקעות...");
  await page
    .waitForFunction(
      () =>
        !window.location.pathname.includes("/login") &&
        (document.body?.innerText?.includes("שווי תיק") ||
          document.body?.innerText?.includes("יתרה לפעילות")),
      { timeout: 45000 },
    )
    .catch(() => {});
  await page
    .waitForNetworkIdle({ idleTime: 800, timeout: 10000 })
    .catch(() => {});
  await delay(2000);

  const bodyText = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
  const summary = parseExcellenceSummary(bodyText);

  for (let i = 0; i < 3; i++) {
    const dismissed = await clickButtonByText(page, [
      "פעם אחרת",
      "בואו נתחיל!",
      "בואו נתחיל",
      "הבנתי",
      "דלג",
    ]);
    if (!dismissed) break;
    await delay(600);
  }

  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-xnes-"));
  try {
    const browserCdp = await page.browser().target().createCDPSession();
    await browserCdp.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadDir,
      eventsEnabled: true,
    });

    const clickVisibleTextEl = async (targetText: string, exact = false): Promise<boolean> => {
      const handles = await page.$$("button, a, li, div, span, [role='button'], [role='menuitem']");
      for (const h of handles) {
        const match = await h
          .evaluate(
            (el, wanted, isExact) => {
              const style = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              if (
                style.display === "none" ||
                style.visibility === "hidden" ||
                rect.width === 0 ||
                rect.height === 0
              ) {
                return false;
              }
              if (el.closest(".cdk-visually-hidden")) return false;
              const t = (el.textContent || "").trim();
              return isExact ? t === wanted : t.includes(wanted) && t.length < 30;
            },
            targetText,
            exact,
          )
          .catch(() => false);
        if (match) {
          await h.click();
          return true;
        }
      }
      return false;
    };

    args.onProgress?.("פותח תפריט ומייצא לאקסל...");
    let exportMenuVisible = await clickVisibleTextEl("יצוא לאקסל", false);
    if (!exportMenuVisible) {
      const menuBtn = await findFirstVisible(
        page,
        ['#menu-button', 'button[aria-label="תפריט"]', 'button[aria-label*="menu" i]'],
        4000,
      );
      if (menuBtn) {
        await menuBtn.click();
        await delay(700);
        exportMenuVisible = await clickVisibleTextEl("יצוא לאקסל", false);
      }
    }

    await delay(800);
    const clickedExport = await clickVisibleTextEl("יצוא", true);

    let rows: string[][] = [];
    let downloadedFile: string | null = null;
    if (clickedExport) {
      args.onProgress?.("קורא דוח אקסל מאקסלנס...");
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        const files = fs
          .readdirSync(downloadDir)
          .filter((f) => !f.endsWith(".crdownload") && !f.endsWith(".tmp"));
        if (files.length > 0) {
          downloadedFile = path.join(downloadDir, files[0]);
          break;
        }
        await delay(350);
      }
      if (downloadedFile) {
        await delay(400);
        const buf = fs.readFileSync(downloadedFile);
        rows = await readSpreadsheetRows(buf, downloadedFile).catch((err) => {
          console.error(`[pension:excellence] spreadsheet parse error (${downloadedFile}):`, err);
          return [];
        });
      }
    }

    const accounts = parseExcellenceRows(rows, summary);
    const hasStockRows =
      rows.length > 0 &&
      accounts.some((a) => a.accountNumber !== "portfolio" && a.assetType === "stock");
    if (!hasStockRows) {
      const debugDir = await saveDebugSnapshot(page, "excellence");
      if (downloadedFile && debugDir) {
        fs.copyFileSync(
          downloadedFile,
          path.join(debugDir, `excellence-export${path.extname(downloadedFile) || ".bin"}`),
        );
      }
      console.warn(
        `[pension:excellence] exportMenuVisible=${exportMenuVisible}, clickedExport=${clickedExport}, downloaded=${downloadedFile ? path.basename(downloadedFile) : "none"}, rows=${rows.length}${debugDir ? ` (debug saved to ${debugDir})` : ""}`,
      );
    }

    if (accounts.length === 0) {
      return {
        success: false,
        accounts: [],
        errorType: "SCRAPE_ERROR",
        errorMessage:
          "לא נמצאו נתוני תיק או ניירות מאקסלנס טרייד. בדוק ששם המשתמש והסיסמה נכונים.",
      };
    }

    return { success: true, accounts };
  } finally {
    fs.rmSync(downloadDir, { recursive: true, force: true });
  }
}

/** Runs our custom Puppeteer scraper for Excellence Trade. */
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

    const outcome = await scrapeExcellence(page, args);
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
