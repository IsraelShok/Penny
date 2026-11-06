import { describe, expect, it } from "vitest";
import { resilience } from "@/lib/resilience";

const base = { cash: 60000, monthlyIncome: 12500, monthlyExpenses: 10000, highInterestDebt: false, goodMonths: 6, monthsCounted: 6, freeToSpend: 2000 };

describe("resilience", () => {
  it("gives full marks when every factor is met", () => {
    const r = resilience(base);
    expect(r.score).toBe(100);
    expect(r.band).toBe("strong");
  });

  it("scales each factor and names the weakest", () => {
    const r = resilience({ ...base, cash: 30000, monthlyIncome: 11000, goodMonths: 3, highInterestDebt: true, freeToSpend: null });
    const pts = Object.fromEntries(r.factors.map((f) => [f.key, f.points]));
    expect(pts).toEqual({ emergency: 15, savings: 11, stability: 10, debt: 0, buffer: 5 });
    expect(r.score).toBe(41);
    expect(r.band).toBe("steady");
    expect(r.weakest).toBe("debt");
  });

  it("handles no data without dividing by zero", () => {
    const r = resilience({ cash: 0, monthlyIncome: 0, monthlyExpenses: 0, highInterestDebt: false, goodMonths: 0, monthsCounted: 0, freeToSpend: -1 });
    expect(r.score).toBe(15);
    expect(r.band).toBe("building");
    expect(r.savingsRate).toBeNull();
    expect(r.weakest).toBe("emergency");
  });
});
