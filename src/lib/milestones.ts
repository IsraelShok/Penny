// Money milestones auto-detected for "Your journey". Pure; unit-tested.
// Celebrates outcomes (money reached), never app usage.

export type Milestone =
  | { kind: "netWorth"; amount: number; date: string | null }
  | { kind: "debtPaid"; name: string; date: string | null }
  | { kind: "goalReached"; name: string; date: string | null }
  | { kind: "savingsRate"; month: string; rate: number; date: string | null }
  | { kind: "emergency"; months: 3 | 6; date: string | null };

export interface MilestoneInput {
  /** Net worth history, any order. */
  history: { date: string; netWorth: number }[];
  liabilities: { name: string; value: number | null; updatedAt?: string }[];
  goals: { name: string; targetAmount: number; savedAmount: number }[];
  /** Per YYYY-MM. */
  months: { month: string; income: number; kept: number }[];
  cashReserve: number;
  monthlyExpenses: number;
}

const NET_WORTH_STEPS = [10_000, 50_000, 100_000];

export function detectMilestones(i: MilestoneInput): Milestone[] {
  const out: Milestone[] = [];
  const hist = [...i.history].sort((a, b) => a.date.localeCompare(b.date));
  for (const amount of NET_WORTH_STEPS) {
    // Only a real crossing counts: a point below the line, later one at or above it.
    const firstBelow = hist.findIndex((p) => p.netWorth < amount);
    if (firstBelow < 0) continue;
    const hit = hist.slice(firstBelow).find((p) => p.netWorth >= amount);
    if (hit) out.push({ kind: "netWorth", amount, date: hit.date.slice(0, 10) });
  }
  for (const l of i.liabilities) {
    if (l.value === 0) out.push({ kind: "debtPaid", name: l.name, date: l.updatedAt?.slice(0, 10) ?? null });
  }
  for (const g of i.goals) {
    if (g.targetAmount > 0 && g.savedAmount >= g.targetAmount) out.push({ kind: "goalReached", name: g.name, date: null });
  }
  const first = [...i.months]
    .sort((a, b) => a.month.localeCompare(b.month))
    .find((m) => m.income > 0 && m.kept / m.income >= 0.2);
  if (first) out.push({ kind: "savingsRate", month: first.month, rate: first.kept / first.income, date: `${first.month}-01` });
  if (i.monthlyExpenses > 0) {
    const cover = i.cashReserve / i.monthlyExpenses;
    // The bigger one says it all.
    if (cover >= 6) out.push({ kind: "emergency", months: 6, date: null });
    else if (cover >= 3) out.push({ kind: "emergency", months: 3, date: null });
  }
  return out;
}

/** Newest first; undated (true now) on top. */
export function sortNewestFirst<T extends { date: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.date ?? "9999").localeCompare(a.date ?? "9999"));
}
