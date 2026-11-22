import { describe, expect, it } from "vitest";
import { parseAmount, parseBankSms, quickAddInput } from "@/lib/quick-add";

const TODAY = "2026-11-22";

describe("parseAmount", () => {
  it("reads numbers, thousands and decimal commas", () => {
    expect(parseAmount(12)).toBe(12);
    expect(parseAmount("1,234.50")).toBe(1234.5);
    expect(parseAmount("12,5")).toBe(12.5);
    expect(parseAmount("₪ 40")).toBe(40);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
});

describe("quickAddInput", () => {
  it("defaults to an expense dated today", () => {
    expect(quickAddInput({ amount: "35.5", description: " קפה " }, TODAY)).toEqual({
      kind: "expense",
      amount: 35.5,
      description: "קפה",
      date: TODAY,
    });
  });
  it("keeps an income kind, date and account, and passes bad values on for validation", () => {
    expect(
      quickAddInput({ amount: "x", kind: "income", date: "2026-11-01", account: "1234" }, TODAY),
    ).toMatchObject({ kind: "income", amount: "x", date: "2026-11-01", account: "1234" });
  });
});

describe("parseBankSms", () => {
  it("reads the common approved-charge wording", () => {
    expect(
      parseBankSms('בכרטיסך המסתיים ב-1234 אושרה עסקה ב-שופרסל דיל בסך 123.45 ש"ח', TODAY),
    ).toEqual({ amount: 123.45, description: "שופרסל דיל", date: TODAY, last4: "1234" });
  });
  it("reads a dated message with ₪ and a trailing merchant", () => {
    expect(
      parseBankSms(
        "לקוח יקר, בכרטיס 9876 בוצעה עסקה ב 12/11 בסכום 89.90 ₪ ב-סופר פארם. לפרטים חייגו",
        TODAY,
      ),
    ).toEqual({ amount: 89.9, description: "סופר פארם", date: "2026-11-12", last4: "9876" });
  });
  it("reads the business-name wording with thousands and gershayim", () => {
    expect(
      parseBankSms("עסקה בסך 1,250.00 ש״ח בכרטיס המסתיים ב 5678 בבית העסק רמי לוי אושרה", TODAY),
    ).toEqual({ amount: 1250, description: "רמי לוי", date: TODAY, last4: "5678" });
  });
  it("reads a charged-card message with a full date", () => {
    expect(parseBankSms("חויב כרטיסך 4321 בסך 45 ₪ ב-פז דלק בתאריך 05.11.26", TODAY)).toEqual({
      amount: 45,
      description: "פז דלק",
      date: "2026-11-05",
      last4: "4321",
    });
  });
  it("puts a future day-month in last year and does not read the amount as a date", () => {
    expect(parseBankSms('אושרה רכישה ב-AliExpress בסך 5.10 ש"ח 30/12', TODAY)).toMatchObject({
      amount: 5.1,
      description: "AliExpress",
      date: "2025-12-30",
    });
  });
  it("ignores foreign currency, chat and commands", () => {
    expect(parseBankSms("אושרה עסקה ב-Amazon בסך 20.00 $", TODAY)).toBeNull();
    expect(parseBankSms("מה המצב החודש?", TODAY)).toBeNull();
    expect(parseBankSms("/month", TODAY)).toBeNull();
    expect(parseBankSms('אושרה עסקה בסך 20 ש"ח', TODAY)).toBeNull();
  });
});
