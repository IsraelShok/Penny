import { describe, expect, it } from "vitest";
import { freelanceSetAside, nextVatDue } from "@/lib/freelance";

describe("freelanceSetAside", () => {
  it("₪20,000 in, ₪5,000 expenses, 10% advances, VAT registered", () => {
    const r = freelanceSetAside({ income: 20_000, expenses: 5_000, vatRegistered: true });
    expect(r.profit).toBe(15_000);
    expect(r.taxAdvance).toBe(2_000);
    expect(r.bituach).toBeCloseTo(7703 * 0.061 + 7297 * 0.18, 1);
    expect(r.pension).toBeCloseTo(6884.5 * 0.0445 + 6884.5 * 0.1255, 1); // capped at the average wage
    expect(r.vat).toBeCloseTo(3_600, 5);
    expect(r.total).toBeCloseTo(2_000 + r.bituach, 5);
  });

  it("a loss month sets aside only the advance", () => {
    const r = freelanceSetAside({ income: 3_000, expenses: 4_000 });
    expect(r.bituach).toBe(0);
    expect(r.pension).toBe(0);
    expect(r.vat).toBe(0);
  });
});

describe("nextVatDue", () => {
  it("is the 15th after each two-month period", () => {
    expect(nextVatDue(new Date(2026, 10, 6))).toEqual(new Date(2026, 10, 15));
    expect(nextVatDue(new Date(2026, 10, 16))).toEqual(new Date(2027, 0, 15));
    expect(nextVatDue(new Date(2026, 1, 1))).toEqual(new Date(2026, 2, 15));
  });
});
