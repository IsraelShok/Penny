// Per-child spending summary (pure, unit-tested).

export interface ChildRow { date: string; amount: number; category: string | null }
export interface ChildSummary { month: number; year: number; top: { category: string | null; total: number }[] }

/** Spent this month (`month` = YYYY-MM) and this year, plus the year's top 3 categories. Refunds reduce totals. */
export function childSummary(rows: ChildRow[], month: string): ChildSummary {
  const year = month.slice(0, 4);
  let m = 0;
  let y = 0;
  const cats = new Map<string | null, number>();
  for (const r of rows) {
    if (!r.date.startsWith(year)) continue;
    y -= r.amount;
    if (r.date.startsWith(month)) m -= r.amount;
    cats.set(r.category, (cats.get(r.category) ?? 0) - r.amount);
  }
  const top = [...cats].map(([category, total]) => ({ category, total })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 3);
  return { month: m, year: y, top };
}
