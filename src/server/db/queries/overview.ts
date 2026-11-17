import "server-only";

import { getDb } from "../index";
import type { PeriodRange } from "@/lib/period";
import type { CostType, NeedType, OverviewCategoryRow, OverviewTotals } from "@/lib/types";

const BASE = `t.workspace_id = ? AND t.date >= ? AND t.date <= ?
  AND t.status = 'completed' AND t.is_excluded = 0`;

export function getPeriodTotals(workspaceId: number, r: PeriodRange): OverviewTotals {
  const row = getDb()
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.personal_amount END), 0) as income,
         COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN -t.personal_amount END), 0) as expenses
       FROM transactions t WHERE ${BASE}`
    )
    .get(workspaceId, r.from, r.to) as { income: number; expenses: number };
  const net = row.income - row.expenses;
  return { ...row, net, savingsRate: row.income > 0 ? net / row.income : null };
}

/** Groups a date into its budget month when months start on `startDay`. */
const monthOf = (startDay: number) => [`substr(date(t.date, ?), 1, 7)`, `-${startDay - 1} days`] as const;

/** Income and expenses per YYYY-MM inside the range. */
export function getMonthlyFlow(workspaceId: number, r: PeriodRange, startDay = 1) {
  const [month, shift] = monthOf(startDay);
  const rows = getDb()
    .prepare(
      `SELECT ${month} as month,
         COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.personal_amount END), 0) as income,
         COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN -t.personal_amount END), 0) as expenses
       FROM transactions t WHERE ${BASE} GROUP BY month`
    )
    .all(shift, workspaceId, r.from, r.to) as { month: string; income: number; expenses: number }[];
  const byMonth = new Map(rows.map((x) => [x.month, x]));
  return r.months.map((m) => byMonth.get(m) ?? { month: m, income: 0, expenses: 0 });
}

/** Expense split by 50/30/20 bucket and by fixed/variable/unplanned. Uncategorised spend is reported apart. */
export function getSpendingTypeSplit(workspaceId: number, r: PeriodRange) {
  const rows = getDb()
    .prepare(
      `SELECT c.need_type as needType, c.cost_type as costType, SUM(-t.personal_amount) as amount
       FROM category_transactions t LEFT JOIN categories c ON c.id = t.category_id
       WHERE ${BASE} AND t.kind = 'expense'
       GROUP BY c.need_type, c.cost_type`
    )
    .all(workspaceId, r.from, r.to) as { needType: NeedType | null; costType: CostType | null; amount: number }[];
  const byNeed: Record<NeedType, number> = { need: 0, want: 0, saving: 0 };
  const byCost: Record<CostType, number> = { fixed: 0, variable: 0, unplanned: 0 };
  let uncategorized = 0;
  for (const x of rows) {
    if (!x.needType || !x.costType) {
      uncategorized += x.amount;
      continue;
    }
    byNeed[x.needType] += x.amount;
    byCost[x.costType] += x.amount;
  }
  return { byNeed, byCost, uncategorized };
}

/** Expense per top-level category (children rolled up), with a per-month breakdown and comparison totals. */
export function getCategoryRows(
  workspaceId: number,
  r: PeriodRange,
  previous: PeriodRange,
  lastYear: PeriodRange,
  startDay = 1
): OverviewCategoryRow[] {
  const db = getDb();
  const [month, shift] = monthOf(startDay);
  const sumBy = (from: string, to: string, byMonth: boolean) =>
    db
      .prepare(
        `SELECT COALESCE(c.parent_id, c.id) as key${byMonth ? `, ${month} as month, c.need_type as needType` : ""},
           SUM(-t.personal_amount) as amount
         FROM category_transactions t JOIN categories c ON c.id = t.category_id
         WHERE ${BASE} AND t.kind = 'expense'
         GROUP BY key${byMonth ? ", month, needType" : ""}`
      )
      .all(...(byMonth ? [shift] : []), workspaceId, from, to) as { key: number; month?: string; needType?: NeedType; amount: number }[];

  const current = sumBy(r.from, r.to, true);
  const prev = new Map(sumBy(previous.from, previous.to, false).map((x) => [x.key, x.amount]));
  const ly = new Map(sumBy(lastYear.from, lastYear.to, false).map((x) => [x.key, x.amount]));
  const cats = new Map(
    (db
      .prepare("SELECT id, name, color, icon FROM categories WHERE workspace_id = ? AND kind = 'expense'")
      .all(workspaceId) as { id: number; name: string; color: string; icon: string | null }[]).map((c) => [c.id, c])
  );

  const rows = new Map<number, OverviewCategoryRow>();
  for (const x of current) {
    const cat = cats.get(x.key);
    if (!cat) continue;
    const row =
      rows.get(x.key) ??
      { categoryId: cat.id, name: cat.name, color: cat.color, icon: cat.icon, byNeed: {}, spent: 0, monthly: Object.fromEntries(r.months.map((m) => [m, 0])), previous: prev.get(x.key) ?? 0, lastYear: ly.get(x.key) ?? 0 };
    row.spent += x.amount;
    if (x.month) row.monthly[x.month] = (row.monthly[x.month] ?? 0) + x.amount;
    if (x.needType) row.byNeed[x.needType] = (row.byNeed[x.needType] ?? 0) + x.amount;
    rows.set(x.key, row);
  }
  return [...rows.values()].sort((a, b) => b.spent - a.spent);
}
