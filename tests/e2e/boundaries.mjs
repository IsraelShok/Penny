// Boundary UI checks against a running Penny (read-only: never saves data).
// Run: node tests/e2e/boundaries.mjs            (BASE defaults to http://127.0.0.1:3002)
//      BASE=http://127.0.0.1:3000 node tests/e2e/boundaries.mjs
// Needs Google Chrome installed (playwright-core, channel "chrome"). Exits 1 on any failure.
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://127.0.0.1:3002";
const fails = [];
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"} ${msg}`); if (!ok) fails.push(msg); };

const browser = await chromium.launch({ channel: "chrome" });

async function newPage(width = 1280, height = 800) {
  const p = await browser.newPage({ viewport: { width, height } });
  await p.goto(`${BASE}/profiles`, { waitUntil: "networkidle" });
  // With 2+ profiles the first visit asks "who's using?"; pick the first one.
  const pick = p.getByRole("button").filter({ hasText: /./ }).first();
  if (p.url().includes("/profiles") && (await pick.count())) { await pick.click(); await p.waitForTimeout(800); }
  return p;
}
const badText = (p) => p.evaluate(() => (document.querySelector("main")?.innerText.match(/\bNaN\b|\bInfinity\b|\bundefined\b/) ?? [null])[0]);

// 1. Wheel paging: past the bottom of a page opens the next one, landing at the top; up reverses.
{
  const p = await newPage();
  const path = () => new URL(p.url()).pathname + new URL(p.url()).search;
  const wheel = async (dy) => {
    const before = p.url();
    await p.mouse.move(640, 400);
    for (let i = 0; i < 120 && p.url() === before; i++) { await p.mouse.wheel(0, dy); await p.waitForTimeout(25); }
    await p.waitForTimeout(800);
  };
  await p.goto(`${BASE}/transactions`, { waitUntil: "networkidle" });
  await wheel(150);
  check(path().startsWith("/budget"), `wheel down from /transactions opens /budget (got ${path()})`);
  check(await p.evaluate(() => scrollY) < 200, "paged-to page starts near its top");
  await p.goto(`${BASE}/budget`, { waitUntil: "networkidle" });
  await wheel(-150);
  check(path() === "/transactions", `wheel up from /budget opens /transactions (got ${path()})`);
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await wheel(-150);
  check(path() === "/", "wheel up on the first page stays put");
  await p.close();
}

// 2. Layout at boundary widths: no horizontal page scroll, no NaN/Infinity/undefined in the text.
for (const width of [320, 375, 390, 767, 768, 769, 1023, 1024, 1279, 1280, 2560]) {
  const p = await newPage(width, 900);
  for (const url of ["/", "/transactions", "/budget", "/investments", "/more", "/settings/general"]) {
    await p.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(overflow <= 1, `${width}px ${url}: no horizontal scroll (${overflow}px)`);
    const bad = await badText(p);
    check(!bad, `${width}px ${url}: no "${bad}" in text`);
  }
  await p.close();
}

// 3. Calculators: edge inputs never show NaN/Infinity and never freeze the page.
{
  const p = await newPage();
  for (const slug of ["compound", "fees", "inflation", "goal", "mortgage", "loan", "credit", "leaseBuy", "net", "budget", "emergency", "fire"]) {
    await p.goto(`${BASE}/calculators/${slug}`, { waitUntil: "networkidle" });
    const inputs = p.locator("main input[id^=calc-]");
    for (const value of ["0", "-5", "0.01", "1e400", "999999999999999", "1.23456789", ""]) {
      const t = Date.now();
      for (let i = 0; i < (await inputs.count()); i++) await inputs.nth(i).fill(value);
      const bad = await badText(p);
      check(!bad && Date.now() - t < 5000, `/calculators/${slug} with "${value}": ${bad ? `shows ${bad}` : "ok"} in ${Date.now() - t}ms`);
    }
  }
  await p.close();
}

await browser.close();
console.log(`\n${fails.length ? `${fails.length} failed` : "all passed"}`);
process.exit(fails.length ? 1 : 0);
