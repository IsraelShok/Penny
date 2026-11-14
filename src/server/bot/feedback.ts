import "server-only";

import { getDb } from "../db/index";
import { getBudgetForCategory } from "../db/queries/budgets";
import { computeCashAhead } from "../insights/cash-ahead";
import { freeLine, moneyFor } from "./snapshot";

interface NewSpend { amount: number; description: string; categoryId: number | null; category: string | null }

/**
 * The message sent right after a sync: the biggest new expenses, each with what is left in its
 * category budget, then the free-to-spend line. Null when the sync brought no new expense.
 */
export function spendFeedback(ws: number, since: string, today: string, hide = false): string | null {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ABS(t.charged_amount) as amount, t.description, t.category_id as categoryId, c.name as category
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.workspace_id = ? AND t.created_at >= ? AND t.kind = 'expense' AND t.is_excluded = 0
         AND t.status IN ('completed', 'pending')
       ORDER BY ABS(t.charged_amount) DESC`
    )
    .all(ws, since) as NewSpend[];
  if (rows.length === 0) return null;

  const money = moneyFor(hide);
  const cash = computeCashAhead(ws, today);
  // shortcut: budget month is the calendar month, upgrade to the plan's monthStartDay if budgets move to it.
  const monthStart = `${today.slice(0, 7)}-01`;
  const spentIn = db.prepare(
    `SELECT COALESCE(SUM(ABS(charged_amount)), 0) as total FROM transactions
     WHERE workspace_id = ? AND category_id = ? AND kind = 'expense' AND is_excluded = 0
       AND status IN ('completed', 'pending') AND date >= ? AND date <= ?`
  );

  const lines = rows.slice(0, 3).map((r) => {
    const head = `• ${money(r.amount)} ${r.description}`;
    const budget = r.categoryId == null ? null : getBudgetForCategory(ws, r.categoryId);
    if (!budget || budget.monthlyAmount <= 0) return r.category ? `${head} (${r.category})` : head;
    const spent = (spentIn.get(ws, r.categoryId, monthStart, `${today}T23:59:59`) as { total: number }).total;
    const left = budget.monthlyAmount - spent;
    const ratio = spent / budget.monthlyAmount;
    const dot = ratio >= 1 ? "🔴" : ratio >= 0.8 ? "🟡" : "🟢";
    return left < 0
      ? `${head}\n   ${dot} ${r.category}: חריגה של ${money(-left)} מהתקציב`
      : `${head}\n   ${dot} ${r.category}: נשארו ${money(left)} החודש`;
  });

  const more = rows.length > 3 ? `ועוד ${rows.length - 3} עסקאות חדשות.` : null;
  return [rows.length === 1 ? "💳 הוצאה חדשה" : `💳 ${rows.length} הוצאות חדשות`, ...lines, more, "", freeLine(cash, money)]
    .filter((l) => l !== null)
    .join("\n");
}
