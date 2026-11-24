import { describe, expect, it } from "vitest";
import { assetKey, INTERACTIVE, isPensionFund, LOGIN_FIELDS, savingsType } from "@/lib/pension";
import { parseExcellenceRows, parseExcellenceSummary, readSpreadsheetRows } from "@/server/pension/parsers";

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
