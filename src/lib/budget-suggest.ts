export interface CategoryHistory {
  categoryId: number;
  name: string;
  /** Spend in each complete month that has data (transfers and excluded rows already left out). */
  monthly: number[];
  currentBudget: number | null;
}

export interface BudgetSuggestion {
  categoryId: number;
  name: string;
  average: number;
  suggested: number;
  currentBudget: number | null;
}

/** Round up to a friendly step: 10 under ₪500, 50 under ₪2,000, else 100. */
export function friendlyRound(n: number): number {
  const step = n < 500 ? 10 : n < 2000 ? 50 : 100;
  return Math.ceil(n / step) * step;
}

/** Paamonim-style: a budget per category from its real average spend. */
export function suggestBudgets(rows: CategoryHistory[]): BudgetSuggestion[] {
  return rows
    .map((r) => {
      const average = r.monthly.length
        ? r.monthly.reduce((s, v) => s + v, 0) / r.monthly.length
        : 0;
      return {
        categoryId: r.categoryId,
        name: r.name,
        average: Math.round(average),
        suggested: friendlyRound(average),
        currentBudget: r.currentBudget,
      };
    })
    .filter((s) => s.average > 0)
    .sort((a, b) => b.average - a.average);
}

/** Month-end total if spending keeps the pace so far. */
export function projectMonthEnd(spent: number, elapsedPercent: number): number {
  return elapsedPercent > 0 ? Math.round(spent / (Math.min(100, elapsedPercent) / 100)) : spent;
}
