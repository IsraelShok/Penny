import { describe, expect, it } from "vitest";
import { growth, inflation, leaseVsBuy, loan, mortgage, payoffPlan, renovationBudget, savingsGoal, split503020, type Debt } from "@/lib/calculators";

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
