import { describe, expect, it } from "vitest";
import { inflation, leaseVsBuy, loan, mortgage, savingsGoal, split503020 } from "@/lib/calculators";

describe("loan / mortgage", () => {
  it("matches the textbook payment and sums tracks", () => {
    const l = loan({ amount: 1_000_000, ratePct: 5, years: 25 });
    expect(l.monthly).toBeCloseTo(5_845.9, 0);
    expect(l.interest).toBeCloseTo(l.monthly * 300 - 1_000_000, 6);
    expect(loan({ amount: 12_000, ratePct: 0, years: 1 }).monthly).toBe(1_000);
    const m = mortgage([{ amount: 1_000_000, ratePct: 5, years: 25 }, { amount: 0, ratePct: 4, years: 20 }, { amount: 12_000, ratePct: 0, years: 1 }]);
    expect(m.monthly).toBeCloseTo(l.monthly + 1_000, 6);
  });
});

describe("inflation", () => {
  it("discounts and grows symmetrically", () => {
    const r = inflation(100, 10, 2);
    expect(r.realValue).toBeCloseTo(100 / 1.21, 6);
    expect(r.needed).toBeCloseTo(121, 6);
  });
});

describe("savingsGoal", () => {
  it("no return divides the gap; already funded is 0", () => {
    expect(savingsGoal(12_000, 0, 12, 0)).toBe(1_000);
    expect(savingsGoal(1_000, 2_000, 12, 5)).toBe(0);
    expect(savingsGoal(12_000, 0, 12, 5)).toBeLessThan(1_000);
  });
});

describe("split503020", () => {
  it("splits the whole income", () => {
    const s = split503020(10_000);
    expect(s.needs + s.wants + s.savings).toBe(10_000);
    expect(s.savings).toBe(2_000);
  });
});

describe("leaseVsBuy", () => {
  it("cash buy at 0% costs only depreciation", () => {
    const r = leaseVsBuy({ price: 150_000, residualPct: 60, years: 3, ratePct: 0, leaseMonthly: 2_500, leaseUpfront: 10_000 });
    expect(r.buy).toBeCloseTo(60_000, 6);
    expect(r.lease).toBe(100_000);
    expect(r.diff).toBeCloseTo(40_000, 6);
  });
});
