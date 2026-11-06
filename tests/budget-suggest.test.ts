import { describe, expect, it } from "vitest";
import { friendlyRound, projectMonthEnd, suggestBudgets } from "@/lib/budget-suggest";

describe("friendlyRound", () => {
  it("rounds up by 10 / 50 / 100", () => {
    expect(friendlyRound(431)).toBe(440);
    expect(friendlyRound(490)).toBe(490);
    expect(friendlyRound(499.5)).toBe(500);
    expect(friendlyRound(1201)).toBe(1250);
    expect(friendlyRound(1999)).toBe(2000);
    expect(friendlyRound(2001)).toBe(2100);
  });
});

describe("suggestBudgets", () => {
  it("averages, rounds up, skips no-spend, sorts biggest first", () => {
    const out = suggestBudgets([
      { categoryId: 1, name: "a", monthly: [100, 200, 300], currentBudget: null },
      { categoryId: 2, name: "b", monthly: [0, 0, 0], currentBudget: 50 },
      { categoryId: 3, name: "c", monthly: [], currentBudget: null },
      { categoryId: 4, name: "d", monthly: [3000, 2500], currentBudget: 2000 },
    ]);
    expect(out).toEqual([
      { categoryId: 4, name: "d", average: 2750, suggested: 2800, currentBudget: 2000 },
      { categoryId: 1, name: "a", average: 200, suggested: 200, currentBudget: null },
    ]);
  });
});

describe("projectMonthEnd", () => {
  it("extrapolates the pace", () => {
    expect(projectMonthEnd(1000, 25)).toBe(4000);
    expect(projectMonthEnd(1000, 100)).toBe(1000);
    expect(projectMonthEnd(0, 0)).toBe(0);
  });
});
