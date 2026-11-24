import { describe, expect, it } from "vitest";
import { assetKey, INTERACTIVE, isPensionFund, LOGIN_FIELDS, savingsType } from "@/lib/pension";
import { extractAltshulerAccounts, parseHebrewAmount } from "@/server/pension/parsers";

describe("pension helpers", () => {
  it("maps portal labels to asset types", () => {
    expect(savingsType("קרן השתלמות מיטב")).toBe("study_fund");
    expect(savingsType("קופת גמל להשקעה")).toBe("provident");
    expect(savingsType("קרן פנסיה מקיפה")).toBe("pension");
  });

  it("knows which funds are wired", () => {
    expect(isPensionFund("meitav")).toBe(true);
    expect(isPensionFund("altshuler")).toBe(true);
    expect(isPensionFund("yelin")).toBe(false);
  });

  it("configures id+phone and headless OTP for altshuler", () => {
    expect(INTERACTIVE.altshuler).toBe(false);
    expect(LOGIN_FIELDS.altshuler).toEqual(["id", "phone"]);
  });

  it("builds a stable asset key", () => {
    expect(assetKey(3, "123")).toBe("pension:3:123");
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
