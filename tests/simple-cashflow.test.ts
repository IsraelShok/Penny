import { describe, expect, it } from "vitest";
import { buildCashflow, cashflowMonth } from "@/lib/simple-cashflow";
import type { Budget, Category, OverviewPayload, TransactionWithCategory } from "@/lib/types";

const cat = (id: number, p: Partial<Category>) => ({ id, parentId: null, name: `c${id}`, color: "#000", kind: "expense", budgetMode: "tracking", needType: "want", costType: "variable", ...p }) as Category;
const tx = (id: number, date: string, amount: number, categoryId: number | null, p: Partial<TransactionWithCategory> = {}) =>
  ({ id, date, description: `t${id}`, chargedAmount: amount, categoryId, kind: amount > 0 ? "income" : "expense", isExcluded: false, ...p }) as TransactionWithCategory;

/** The whole previous month. */
const previousMonth = {
  totals: { income: 10000 },
  categories: [{ categoryId: 1, spent: 700 }],
} as unknown as OverviewPayload;
const range = { from: new Date(2026, 10, 1), to: new Date(2026, 10, 30) };
const today = new Date(2026, 10, 13);

describe("buildCashflow", () => {
  const cats = [cat(1, {}), cat(2, { costType: "fixed" }), cat(3, { budgetMode: "budgeted" }), cat(4, { needType: "saving" })];
  const budgets: Budget[] = [{ categoryId: 2, monthlyAmount: 3000, isAuto: false }, { categoryId: 3, monthlyAmount: 500, isAuto: false }];
  const txns = [
    tx(1, "2026-11-02", -100, 1),
    tx(2, "2026-11-09", -50, null),
    tx(3, "2026-11-03", -3000, 2),
    tx(4, "2026-11-04", -600, 3),
    tx(5, "2026-11-05", 9000, null),
    tx(6, "2026-11-06", -1000, 4),
    tx(7, "2026-11-07", -400, null, { kind: "transfer" }),
  ];
  const r = buildCashflow(txns, cats, budgets, previousMonth, range, today);

  it("splits lines", () => {
    expect(r.variable).toMatchObject({ spent: 150, expected: 700, left: 550 });
    expect(r.fixed).toMatchObject({ spent: 3000, expected: 3000 });
    expect(r.tracked).toEqual([expect.objectContaining({ id: 3, spent: 600, expected: 500 })]);
    expect(r.savings.spent).toBe(1000);
    expect(r.off.expenseTotal).toBe(400);
    expect(r.income).toMatchObject({ received: 9000, expected: 10000 });
  });

  it("buckets variable spend by week and forecasts the month", () => {
    expect(r.weeks.map((w) => w.spent)).toEqual([100, 50, 0, 0, 0]);
    expect(r.weeks[2].future).toBe(true);
    // 700 spread over 5 weeks; week 1 spent 100, so the 600 left is spread over the 4 weeks after it.
    expect(r.weeks[0].share).toBeCloseTo(140);
    expect(r.weeks[1].share).toBeCloseTo(150);
    expect(r.weeks[2].share).toBeCloseTo((700 - 150) / 3);
    // 10000 expected income − (700 + 3000 + 1000 + 600 over budget)
    expect(r.forecast).toBe(10000 - 5300);
  });

  it("treats a refund on an expense category as less spend, not income", () => {
    const x = buildCashflow([tx(1, "2026-11-02", -300, 1), tx(2, "2026-11-03", 100, 1)], cats, budgets, previousMonth, range, today);
    expect(x.variable.spent).toBe(200);
    expect(x.income.received).toBe(0);
  });

  it("charges each part of a split to its own category", () => {
    const split = tx(1, "2026-11-02", -1000, 1, { allocations: [{ categoryId: 1, amount: 600 }, { categoryId: 2, amount: 400 }] });
    const x = buildCashflow([split], cats, budgets, previousMonth, range, today);
    expect(x.variable.spent).toBe(600);
    expect(x.fixed.spent).toBe(400);
  });

  it("keeps a budget of 0 and expects nothing from parent categories", () => {
    const tree = [cat(10, {}), cat(11, { parentId: 10 })];
    const prev = { totals: { income: 0 }, categories: [{ categoryId: 10, spent: 900 }, { categoryId: 11, spent: 900 }] } as unknown as OverviewPayload;
    const x = buildCashflow([], tree, [{ categoryId: 11, monthlyAmount: 0, isAuto: false }], prev, range, today);
    expect(x.variable.expected).toBe(0);
  });

  it("starts the month on payday", () => {
    const d = new Date(2026, 10, 5);
    expect(cashflowMonth(10, 0, d)).toEqual({ from: new Date(2026, 9, 10), to: new Date(2026, 10, 9) });
    expect(cashflowMonth(1, 1, d)).toEqual({ from: new Date(2026, 9, 1), to: new Date(2026, 9, 31) });
  });
});
