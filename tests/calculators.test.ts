import { describe, expect, it } from "vitest";
import { growth, payoffPlan, renovationBudget, type Debt } from "@/lib/calculators";

describe("growth", () => {
  it("adds deposits only at 0%", () => {
    const g = growth(1_000, 100, 2, 0);
    expect(g.balance).toBeCloseTo(3_400);
    expect(g.earned).toBeCloseTo(0);
    expect(g.yearly).toHaveLength(2);
  });

  it("compounds a lump sum annually", () => {
    expect(growth(10_000, 0, 10, 0.07).balance).toBeCloseTo(10_000 * 1.07 ** 10);
  });
});

describe("payoffPlan", () => {
  const debts: Debt[] = [
    { name: "card", balance: 5_000, ratePct: 18, minPayment: 150 },
    { name: "car", balance: 30_000, ratePct: 7, minPayment: 700 },
    { name: "small", balance: 1_000, ratePct: 4, minPayment: 50 },
  ];

  it("returns null when the budget misses the minimums", () => {
    expect(payoffPlan(debts, 800, "avalanche")).toBeNull();
  });

  it("avalanche pays less interest, snowball clears the smallest first", () => {
    const a = payoffPlan(debts, 1_500, "avalanche")!;
    const s = payoffPlan(debts, 1_500, "snowball")!;
    expect(a.interest).toBeLessThanOrEqual(s.interest);
    expect(s.paidOff[0].name).toBe("small");
    expect(a.paidOff[0].name).toBe("card");
  });

  it("finishes sooner with a bigger budget", () => {
    expect(payoffPlan(debts, 3_000, "avalanche")!.months).toBeLessThan(payoffPlan(debts, 1_500, "avalanche")!.months);
  });

  it("returns null when payments never beat the interest", () => {
    expect(payoffPlan([{ name: "x", balance: 100_000, ratePct: 30, minPayment: 0 }], 100, "avalanche")).toBeNull();
  });
});

describe("renovationBudget", () => {
  it("adds the buffer and borrows only the gap", () => {
    const r = renovationBudget([{ kind: "kitchen", cost: 60_000 }, { kind: "paint", cost: 10_000 }], 0.15, 50_000, 0, 2);
    expect(r.total).toBeCloseTo(80_500);
    expect(r.loan).toBeCloseTo(30_500);
    expect(r.monthly).toBeCloseTo(30_500 / 24);
    expect(r.interest).toBeCloseTo(0);
  });

  it("needs no loan when savings cover it", () => {
    expect(renovationBudget([{ kind: "room", cost: 10_000 }], 0.1, 50_000, 8, 3).loan).toBe(0);
  });
});
