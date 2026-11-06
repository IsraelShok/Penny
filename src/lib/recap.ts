/** Monthly and yearly recap: pure, rule-based summaries of spending. Calendar months. */

export interface RecapExpense { date: string; amount: number; categoryId: number | null; description: string }
export interface RecapCategory { id: number; name: string; needType: string | null }
export interface RecapInput {
  expenses: RecapExpense[];
  /** Income per YYYY-MM. */
  income: Record<string, number>;
  categories: RecapCategory[];
  /** Sum of monthly budgets; 0 when none are set. */
  budgetTotal: number;
  /** YYYY-MM-DD; days after it are not counted yet. */
  today: string;
}

export interface MonthRecap {
  month: string;
  spent: number;
  prevSpent: number;
  income: number;
  kept: number;
  top: { name: string; spent: number; prev: number } | null;
  biggest: { description: string; amount: number; date: string } | null;
  noSpendDays: number;
  longestStreak: number;
  daysCounted: number;
  underBudgetMonths: number | null;
  improved: { name: string; drop: number } | null;
  trim: { name: string; yearly: number } | null;
}

export interface YearRecap {
  year: number;
  spent: number;
  income: number;
  kept: number;
  savingsRate: number | null;
  top: { name: string; spent: number }[];
  bestMonth: { month: string; kept: number } | null;
  noSpendDays: number;
  daysCounted: number;
}

export const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** The last complete month before `today`. */
export const lastCompleteMonth = (today: string) => shiftMonth(today.slice(0, 7), -1);

const daysIn = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** Every YYYY-MM-DD in [from, to]. */
function days(from: string, to: string) {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

function noSpend(expenses: RecapExpense[], from: string, to: string) {
  const spentOn = new Set(expenses.map((e) => e.date));
  const list = days(from, to);
  let count = 0, run = 0, longest = 0;
  for (const d of list) {
    if (spentOn.has(d)) { run = 0; continue; }
    count++; run++; longest = Math.max(longest, run);
  }
  return { count, longest, counted: list.length };
}

const inMonth = (expenses: RecapExpense[], month: string) => expenses.filter((e) => e.date.startsWith(month));
const sum = (expenses: RecapExpense[]) => expenses.reduce((s, e) => s + e.amount, 0);
function byCategory(expenses: RecapExpense[]) {
  const map = new Map<number, number>();
  for (const e of expenses) if (e.categoryId != null) map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + e.amount);
  return map;
}
const lastDay = (month: string, today: string) => {
  const end = `${month}-${String(daysIn(month)).padStart(2, "0")}`;
  return end < today ? end : today;
};

export function monthRecap(month: string, input: RecapInput): MonthRecap {
  const { expenses, categories, budgetTotal, today } = input;
  const cat = new Map(categories.map((c) => [c.id, c]));
  const name = (id: number) => cat.get(id)?.name ?? "";
  const cur = inMonth(expenses, month);
  const prevMonth = shiftMonth(month, -1);
  const prev = inMonth(expenses, prevMonth);
  const spent = sum(cur);
  const income = input.income[month] ?? 0;
  const curBy = byCategory(cur);
  const prevBy = byCategory(prev);
  const ranked = [...curBy].sort((a, b) => b[1] - a[1]);
  const topEntry = ranked[0];
  const biggest = cur.reduce<RecapExpense | null>((b, e) => (!b || e.amount > b.amount ? e : b), null);

  let improved: MonthRecap["improved"] = null;
  for (const [id, before] of prevBy) {
    const drop = before - (curBy.get(id) ?? 0);
    if (drop > 0 && (!improved || drop > improved.drop)) improved = { name: name(id), drop };
  }

  const want = ranked.find(([id]) => cat.get(id)?.needType === "want");
  let underBudgetMonths: number | null = null;
  if (budgetTotal > 0) {
    underBudgetMonths = 0;
    // Look back at most two years; a month with no spending at all means no data, so the run stops.
    for (let m = month, i = 0; i < 24; m = shiftMonth(m, -1), i++) {
      const s = sum(inMonth(expenses, m));
      if (s === 0 || s > budgetTotal) break;
      underBudgetMonths++;
    }
  }

  const ns = noSpend(cur, `${month}-01`, lastDay(month, today));
  return {
    month,
    spent,
    prevSpent: sum(prev),
    income,
    kept: income - spent,
    top: topEntry ? { name: name(topEntry[0]), spent: topEntry[1], prev: prevBy.get(topEntry[0]) ?? 0 } : null,
    biggest: biggest && { description: biggest.description, amount: biggest.amount, date: biggest.date },
    noSpendDays: ns.count,
    longestStreak: ns.longest,
    daysCounted: ns.counted,
    underBudgetMonths,
    improved,
    trim: want ? { name: name(want[0]), yearly: want[1] * 0.1 * 12 } : null,
  };
}

export function yearRecap(year: number, input: RecapInput): YearRecap {
  const { categories, today } = input;
  const expenses = input.expenses.filter((e) => e.date.startsWith(`${year}-`));
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const spent = sum(expenses);
  const income = Object.entries(input.income).filter(([m]) => m.startsWith(`${year}-`)).reduce((s, [, v]) => s + v, 0);
  const kept = income - spent;
  let bestMonth: YearRecap["bestMonth"] = null;
  for (let i = 1; i <= 12; i++) {
    const m = `${year}-${String(i).padStart(2, "0")}`;
    if (`${m}-01` > today) break;
    const s = sum(inMonth(expenses, m));
    const inc = input.income[m] ?? 0;
    if (s === 0 && inc === 0) continue;
    if (!bestMonth || inc - s > bestMonth.kept) bestMonth = { month: m, kept: inc - s };
  }
  const end = `${year}-12-31` < today ? `${year}-12-31` : today;
  const ns = end >= `${year}-01-01` ? noSpend(expenses, `${year}-01-01`, end) : { count: 0, counted: 0 };
  return {
    year,
    spent,
    income,
    kept,
    savingsRate: income > 0 ? kept / income : null,
    top: [...byCategory(expenses)].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, s]) => ({ name: cat.get(id) ?? "", spent: s })),
    bestMonth,
    noSpendDays: ns.count,
    daysCounted: ns.counted,
  };
}
