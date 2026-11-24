import { describe, expect, it } from "vitest";
import { assetKey, INTERACTIVE, isPensionFund, LOGIN_FIELDS, savingsType } from "@/lib/pension";
import { extractPhoenixAccounts, parseHebrewAmount, parsePhoenixProductDetail } from "@/server/pension/parsers";

describe("pension helpers", () => {
  it("maps portal labels to asset types", () => {
    expect(savingsType("קרן השתלמות מיטב")).toBe("study_fund");
    expect(savingsType("קופת גמל להשקעה")).toBe("provident");
    expect(savingsType("קרן פנסיה מקיפה")).toBe("pension");
  });

  it("knows which funds are wired", () => {
    expect(isPensionFund("meitav")).toBe(true);
    expect(isPensionFund("phoenix")).toBe(true);
    expect(isPensionFund("yelin")).toBe(false);
  });

  it("configures id+phone and headless OTP for phoenix", () => {
    expect(INTERACTIVE.phoenix).toBe(false);
    expect(LOGIN_FIELDS.phoenix).toEqual(["id", "phone"]);
  });

  it("builds a stable asset key", () => {
    expect(assetKey(3, "123")).toBe("pension:3:123");
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
