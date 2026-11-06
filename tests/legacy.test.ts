import { describe, expect, it } from "vitest";
import { buildLegacySections, parseLegacyNotes, LEGACY_TEXT_MAX, type LegacyInput } from "@/lib/legacy";
import type { Asset } from "@/lib/types";

const asset = (o: Partial<Asset>): Asset =>
  ({ id: 1, name: "x", type: "cash", currency: "ILS", symbol: null, quantity: null, manualValue: null, costBasis: null, liquid: true, note: null,
    feeDeposit: null, feeBalance: null, monthlyDeposit: null, interestRate: null, monthlyPayment: null, isLiability: false, value: 0, valueIls: 0, gainIls: null, quote: null, ...o }) as Asset;

const input: LegacyInput = {
  assets: [
    asset({ name: "Bank Hapoalim · 8901", type: "cash", valueIls: 23450 }),
    asset({ name: "VOO", type: "stock", symbol: "VOO", valueIls: 1000 }),
    asset({ name: "קרן השתלמות", type: "study_fund", fundId: 1093, valueIls: 165000,
      fund: { fund: { id: 1093, name: "אלטשולר השתלמות כללי", company: "אלטשולר שחם" } } as unknown as Asset["fund"] }),
    asset({ name: "משכנתא", type: "mortgage", isLiability: true, valueIls: 1_180_000, monthlyPayment: 6500 }),
  ],
  policies: [{ id: 1, name: "בריאות", kind: "health", provider: "הראל", monthlyPremium: 180, renewalMonth: "2027-03" }],
  goals: [{ id: 1, name: "דירה", targetAmount: 400000, targetDate: "2029-06", savedAmount: 120000 }],
  // Fields a careless caller might pass along — must never reach the document.
  integrations: [
    { id: 1, provider: "hapoalim", label: "", password: "hunter2", otpLongTermToken: "tok-secret" },
    { id: 2, provider: "isracard", label: "שלי", userCode: "secret-user", card6Digits: "123456" },
  ] as unknown as LegacyInput["integrations"],
  accounts: [{ accountNumber: "5326-1234-5678-4580", label: null, provider: "max", password: "pw-secret" } as LegacyInput["accounts"][number]],
  recurring: [{ merchant: "נטפליקס", account: "4580", expectedAmount: 54.9, cadence: "monthly" }],
};

describe("buildLegacySections", () => {
  const sections = buildLegacySections(input);
  const by = (id: string) => sections.find((s) => s.id === id)!.rows;

  it("groups everything into the right sections", () => {
    expect(sections.map((s) => s.id)).toEqual(["banks", "cards", "investments", "pension", "insurance", "debts", "recurring", "goals"]);
    expect(by("banks")).toEqual([{ title: "Bank Hapoalim · 8901", amount: 23450 }]); // connected bank already covered by its balance
    expect(by("cards").map((r) => r.title)).toEqual(["Max", "Isracard"]);
    expect(by("cards")[0].detail).toBe("•••• 4580");
    expect(by("investments")[0]).toMatchObject({ title: "VOO", kind: "stock", amount: 1000 });
    expect(by("pension")[0].detail).toBe("אלטשולר שחם · אלטשולר השתלמות כללי · #1093");
    expect(by("insurance")[0]).toMatchObject({ detail: "הראל", monthly: 180, when: "2027-03" });
    expect(by("debts")[0]).toMatchObject({ amount: 1_180_000, monthly: 6500 });
    expect(by("recurring")[0]).toMatchObject({ title: "נטפליקס", amount: 54.9, kind: "monthly" });
    expect(by("goals")[0]).toMatchObject({ amount: 400000, saved: 120000 });
  });

  it("never carries credential fields or full account numbers", () => {
    const json = JSON.stringify(sections);
    for (const secret of ["hunter2", "tok-secret", "secret-user", "123456", "pw-secret", "5326", "password", "otp", "token", "userCode"]) {
      expect(json).not.toContain(secret);
    }
  });
});

describe("parseLegacyNotes", () => {
  it("accepts plain text and fills gaps", () => {
    expect(parseLegacyNotes({ contacts: "רו״ח: דנה" })).toEqual({ contacts: "רו״ח: דנה", documents: "", wishes: "", steps: null });
  });
  it("drops unknown keys and rejects bad input", () => {
    expect(parseLegacyNotes({ wishes: "a", password: "x" })).not.toHaveProperty("password");
    expect(() => parseLegacyNotes(null)).toThrow();
    expect(() => parseLegacyNotes({ contacts: 5 })).toThrow();
    expect(() => parseLegacyNotes({ wishes: "a".repeat(LEGACY_TEXT_MAX + 1) })).toThrow();
  });
});
