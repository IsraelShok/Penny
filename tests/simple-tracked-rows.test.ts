import { describe, expect, it } from "vitest";
import { buildCashflow, trackedRows } from "@/lib/simple-cashflow";
import type { Budget, Category, OverviewPayload } from "@/lib/types";

const cat = (id: number, budgetMode: "budgeted" | "tracking"): Category =>
  ({
    id,
    name: `c${id}`,
    color: "#000",
    kind: "expense",
    budgetMode,
    costType: "variable",
    needType: "want",
    parentId: null,
  }) as unknown as Category;
const prev = { categories: [], totals: { income: 0 } } as unknown as OverviewPayload;
const range = { from: new Date(2026, 10, 1), to: new Date(2026, 10, 30) };

describe("simple mode tracked rows", () => {
  it("keeps a picked category with no budget and no spend (the 'added and nothing changed' bug)", () => {
    const cf = buildCashflow(
      [],
      [cat(1, "budgeted"), cat(2, "tracking")],
      [] as Budget[],
      prev,
      range,
      new Date(2026, 10, 14),
    );
    expect(cf.tracked.map((c) => c.id)).toEqual([1]);
    expect(trackedRows(cf.tracked).shown.map((c) => c.id)).toEqual([1]);
  });

  it("orders by spend then expectation and folds the rest when many are picked", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      spent: i % 3 === 0 ? 0 : i * 10,
      expected: i,
    }));
    const { shown, rest } = trackedRows(many, 6);
    expect(shown).toHaveLength(6);
    expect(rest).toHaveLength(24);
    expect(shown[0].id).toBe(29);
    expect(
      [...shown, ...rest].every(
        (r, i, a) =>
          i === 0 ||
          a[i - 1].spent > r.spent ||
          (a[i - 1].spent === r.spent && a[i - 1].expected >= r.expected),
      ),
    ).toBe(true);
  });

  it("does not fold a single leftover", () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ spent: i, expected: 0 }));
    expect(trackedRows(seven, 6)).toMatchObject({ shown: { length: 7 }, rest: [] });
  });
});
