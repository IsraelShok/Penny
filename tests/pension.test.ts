import { describe, expect, it } from "vitest";
import { assetKey, INTERACTIVE, isPensionFund, LOGIN_FIELDS, savingsType } from "@/lib/pension";
import {
  extractAltshulerAccounts,
  extractPhoenixAccounts,
  parseExcellenceRows,
  parseExcellenceSummary,
  parseHebrewAmount,
  parsePhoenixProductDetail,
  readSpreadsheetRows,
} from "@/server/pension/parsers";

describe("pension helpers", () => {
  it("maps portal labels to asset types", () => {
    expect(savingsType("קרן השתלמות מיטב")).toBe("study_fund");
    expect(savingsType("קופת גמל להשקעה")).toBe("provident");
    expect(savingsType("קרן פנסיה מקיפה")).toBe("pension");
  });

  it("knows which funds are wired", () => {
    expect(isPensionFund("meitav")).toBe(true);
    expect(isPensionFund("excellence")).toBe(true);
    expect(isPensionFund("yelin")).toBe(false);
  });

  it("configures username+password for excellence", () => {
    expect(INTERACTIVE.excellence).toBe(false);
    expect(LOGIN_FIELDS.excellence).toEqual(["username", "password"]);
  });

  it("builds a stable asset key", () => {
    expect(assetKey(3, "123")).toBe("pension:3:123");
  });
});

describe("excellence parser", () => {
  it("parses Excellence summary and Excel export", async () => {
    const summary = parseExcellenceSummary(
      "שווי תיק ₪ 100,000.50 רווח / הפסד יומי ₪ 250.00 (0.25%) יתרה לפעילות ₪ 500",
    );
    expect(summary).toEqual({
      portfolioValue: 100000.5,
      dailyPnl: 250,
      dailyPnlPct: 0.25,
      availableCash: 500,
    });

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("תיק");
    ws.addRow(["שם נייר", "סימול", "כמות", "שווי שוק", "עלות", "מטבע"]);
    ws.addRow(["תכלית S&P 500", "1159250", "100", "50,000", "42,000", "ILS"]);
    ws.addRow(['סה"כ', "", "", "50,000", "", "ILS"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const rows = await readSpreadsheetRows(buf, "export.xlsx");
    const accounts = parseExcellenceRows(rows, summary);
    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toMatchObject({
      accountNumber: "1159250",
      label: "אקסלנס - תכלית S&P 500",
      balance: 50000,
      currency: "ILS",
      assetType: "stock",
      symbol: "1159250",
      quantity: 100,
      costBasis: 42000,
    });
    expect(accounts[1]).toMatchObject({
      accountNumber: "available-cash",
      balance: 500,
      assetType: "cash",
    });
  });
});

describe("altshuler parser", () => {
  it("parses Hebrew currency amounts", () => {
    expect(parseHebrewAmount("₪ 245,600.00")).toEqual({ amount: 245600, currency: "ILS" });
    expect(parseHebrewAmount("$1,250.50")).toEqual({ amount: 1250.5, currency: "USD" });
    expect(parseHebrewAmount("-₪ 500")).toEqual({ amount: -500, currency: "ILS" });
  });

  it("extracts Altshuler accounts from cards and HTML fallback", () => {
    const fromCards = extractAltshulerAccounts(
      [{ accNum: "12345", trackName: "גמל להשקעה S&P 500", amount: "₪ 50,000.00" }],
      "",
      "",
      "311111111",
    );
    expect(fromCards).toHaveLength(1);
    expect(fromCards[0].accountNumber).toBe("12345");
    expect(fromCards[0].balance).toBe(50000);
    expect(savingsType(fromCards[0].label ?? "")).toBe("provident");

    const fromHtml = extractAltshulerAccounts(
      [],
      "",
      '<div class="account-summary"><span class="account-number">12345678</span><div class="total-balance">₪ 245,600.00</div></div>',
      "311111111",
    );
    expect(fromHtml).toHaveLength(1);
    expect(fromHtml[0].accountNumber).toBe("12345678");
    expect(fromHtml[0].balance).toBe(245600);
  });
});

describe("phoenix parser", () => {
  it("parses Hebrew currency amounts", () => {
    expect(parseHebrewAmount("₪ 12,345")).toEqual({ amount: 12345, currency: "ILS" });
  });

  it("extracts Phoenix accounts from HTML and detailed savings cards", () => {
    const portalAccounts = extractPhoenixAccounts(
      `<app-saving-item><div><h3><span>קרן השתלמות</span></h3><span dir="ltr">001-234-567890 (12345678)</span><span>₪12,345</span></div></app-saving-item>`,
      "012345678",
    );
    expect(portalAccounts).toHaveLength(1);
    expect(portalAccounts[0].accountNumber).toBe("001-234-567890 (12345678)");
    expect(portalAccounts[0].balance).toBe(12345);
    expect(savingsType(portalAccounts[0].label ?? "")).toBe("study_fund");

    const detailed = parsePhoenixProductDetail({
      name: "קרן השתלמות",
      accountNumber: "001-234-567890 (12345678)",
      text: "מספר חשבון 001-234-567890 (12345678) סכום חיסכון ₪12,345 הפקדה אחרונה ₪1,000.201.01.2025 מועד נזילות 01.01.2030 ד.נ הפקדה 0% ד.נ חיסכון 0.5% מעמד שכירפירוט",
    });
    expect(detailed).not.toBeNull();
    expect(detailed?.balance).toBe(12345);
    expect(detailed?.monthlyDeposit).toBe(1000.2);
    expect(detailed?.feeDeposit).toBe(0);
    expect(detailed?.feeBalance).toBe(0.5);
    expect(detailed?.details).toMatchObject({
      liquidityDate: "01.01.2030",
      status: "שכיר",
      lastDeposit: { amount: 1000.2, date: "01.01.2025" },
    });
  });
});
