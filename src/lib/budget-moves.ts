// "Move from X": one-month budget moves between categories, stored as a JSON workspace setting.
import type { BudgetStatus, CategoryWithData } from "@/lib/types";

export interface BudgetMove { from: number; to: number; amount: number }
/** month (YYYY-MM) -> moves made for that month only. */
export type BudgetMoves = Record<string, BudgetMove[]>;

export function parseMoves(raw: unknown): BudgetMoves {
  const out: BudgetMoves = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [month, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}$/.test(month) || !Array.isArray(list)) continue;
    const moves = list.filter(isMove);
    if (moves.length) out[month] = moves;
  }
  return out;
}

export function isMove(m: unknown): m is BudgetMove {
  const v = m as BudgetMove;
  return !!v && Number.isInteger(v.from) && Number.isInteger(v.to) && v.from !== v.to && Number.isFinite(v.amount) && v.amount > 0;
}

// Same rule as server/lib/pace computeStatus, which is server-only.
function status(spent: number, budget: number, elapsed: number): BudgetStatus {
  if (budget <= 0) return "on-track";
  const pct = (spent / budget) * 100;
  if (pct > 100) return "over";
  const delta = pct - elapsed;
  if (delta >= 20) return "heads-up";
  if (delta <= -30) return "plenty-left";
  return "on-track";
}

/** Effective budget for the month = base budget ± moves; rollup parents follow their children. */
export function applyMoves(rows: CategoryWithData[], moves: BudgetMove[], timeElapsedPercent: number): CategoryWithData[] {
  if (!moves.length) return rows;
  const delta = new Map<number, number>();
  for (const m of moves) {
    delta.set(m.from, (delta.get(m.from) ?? 0) - m.amount);
    delta.set(m.to, (delta.get(m.to) ?? 0) + m.amount);
  }
  return rows.map((r) => {
    let d = delta.get(r.categoryId) ?? 0;
    if (r.isParent && r.budgetSource === "rollup")
      d += rows.filter((c) => c.parentId === r.categoryId && c.budgetMode === "budgeted").reduce((s, c) => s + (delta.get(c.categoryId) ?? 0), 0);
    if (!d) return r;
    const budget = Math.max(0, r.budget + d);
    const remaining = Math.max(0, budget - r.spent);
    return {
      ...r,
      budget,
      remaining,
      // Same days-left divisor as before; unknown when nothing was left before the move.
      perDayRemaining: r.perDayRemaining != null && r.remaining > 0 && remaining > 0 ? (r.perDayRemaining * remaining) / r.remaining : null,
      percentSpent: budget > 0 ? (r.spent / budget) * 100 : 0,
      status: status(r.spent, budget, timeElapsedPercent),
    };
  });
}

/** Categories that can give budget to `toId` this month, most room first. Rollup parents are skipped (their room belongs to the children). */
export function roomToMove(rows: CategoryWithData[], toId: number) {
  return rows
    .filter((r) => r.categoryId !== toId && r.budgetMode === "budgeted" && r.budget > 0 && r.remaining > 0 && !(r.isParent && r.budgetSource === "rollup"))
    .map((r) => ({ categoryId: r.categoryId, categoryName: r.categoryName, room: r.remaining }))
    .sort((a, b) => b.room - a.room);
}

const isOver = (r: CategoryWithData) => r.budgetMode === "budgeted" && r.budget > 0 && r.spent > r.budget;

/** Which category takes the move for a card: itself when over, or for a rollup parent its most-over child. Null when none is over. */
export function moveTarget(r: CategoryWithData, rows: CategoryWithData[]): CategoryWithData | null {
  if (!(r.isParent && r.budgetSource === "rollup")) return isOver(r) ? r : null;
  const kids = rows.filter((c) => c.parentId === r.categoryId && isOver(c)).sort((a, b) => (b.spent - b.budget) - (a.spent - a.budget));
  return kids[0] ?? null;
}
