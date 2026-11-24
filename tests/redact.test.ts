import { describe, expect, it } from "vitest";
import { redact, redactError } from "@/server/lib/redact";

describe("redact", () => {
  it("removes secrets, emails and long numbers", () => {
    const s = redact(
      'fail {"password":"hunter2"} id=123456789 sk-ant-api03-abcdefghijklmnopqrstuv me@x.co 1234-5678-9012-3456 bot 123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsawq',
    );
    expect(s).not.toMatch(/hunter2|123456789|abcdefghij|me@x\.co|9012|AAHdq/);
  });

  it("keeps amounts and dates", () => {
    expect(redact("שופרסל 120.50 on 2026-11-06")).toBe("שופרסל 120.50 on 2026-11-06");
  });

  it("redacts error messages", () => {
    expect(redactError(new Error("account 9876543 locked"))).toBe("Error: account [number] locked");
  });
});

describe("redact, cases a cloud prompt or log must not carry", () => {
  it("masks IBANs, phones, digits glued to letters and bot tokens inside a URL", async () => {
    const { redact } = await import("@/server/lib/redact");
    expect(redact("IL620108000000099999999")).toBe("[iban]");
    expect(redact("054-123-4567 / 0541234567 / 03-1234567")).toBe("[phone] / [phone] / [phone]");
    expect(redact("ACC12345678 ID_123456789")).toBe("ACC[number] ID_[number]");
    expect(redact("https://api.telegram.org/bot123456789:" + "A".repeat(35) + "/getMe")).toBe(
      "https://api.telegram.org/[token]/getMe",
    );
    // Dates and amounts stay readable.
    expect(redact("2026-11-24 ₪1,234.50")).toBe("2026-11-24 ₪1,234.50");
  });

  it("keeps a transfer's memo and standing-order payee away from a cloud model", async () => {
    const { buildCategorizationPrompt } = await import("@/server/ai/prompts");
    const prompt = buildCategorizationPrompt(
      [
        { description: "העברה לדנה כהן", amount: -100, currency: "ILS", memo: "לטובת דנה כהן" },
        { description: "הוראת קבע לדנה כהן", amount: -50, currency: "ILS" },
      ] as never,
      [],
    );
    expect(prompt).not.toContain("דנה");
    expect(prompt).toContain(" | ILS 100.00");
  });
});
