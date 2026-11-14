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
    // Unknown balance: buffer is skipped, so 36 of 90 points rescale to 40.
    expect(pts).toEqual({ emergency: 15, savings: 11, stability: 10, debt: 0 });
    expect(r.score).toBe(40);
    expect(r.band).toBe("steady");
    expect(r.weakest).toBe("debt");
  });

  it("handles no data without dividing by zero", () => {
    const r = resilience({ cash: 0, monthlyIncome: 0, monthlyExpenses: 0, highInterestDebt: false, goodMonths: 0, monthsCounted: 0, freeToSpend: -1 });
    // No past months: stability skipped, 15 of 80 points rescale to 19.
    expect(r.score).toBe(19);
    expect(r.band).toBe("building");
    expect(r.savingsRate).toBeNull();
    expect(r.weakest).toBe("emergency");
  });

  it("drops a factor that doesn't apply and rescales to 100", () => {
    const r = resilience({ ...base, cash: 30000, highInterestDebt: null });
    expect(r.factors.map((f) => f.key)).not.toContain("debt");
    // 15 + 25 + 20 + 10 = 70 of 85.
    expect(r.score).toBe(82);
    expect(resilience({ ...base, highInterestDebt: null }).score).toBe(100);
  });
});
