import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { getAllBudgets } from "@/server/db/queries/budgets";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { lastCompleteMonth, monthRecap, shiftMonth, yearRecap, type RecapCategory, type RecapExpense } from "@/lib/recap";

export const dynamic = "force-dynamic";

// shortcut: calendar months, ignoring the plan's monthStartDay; switch to period.ts ranges if users ask.
export async function GET(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const params = new URL(request.url).searchParams;
  const month = params.get("month");
  const yearParam = params.get("year");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  if ((month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) || (yearParam && !/^\d{4}$/.test(yearParam))) {
    return NextResponse.json({ error: "invalid month or year" }, { status: 400 });
  }
  const target = month ?? lastCompleteMonth(today);
  // Month mode looks back two years for the "under budget" run.
  const [from, to] = yearParam ? [`${yearParam}-01-01`, `${yearParam}-12-31`] : [`${shiftMonth(target, -24)}-01`, `${target}-31`];

  const db = getDb();
  const where = `t.workspace_id = ? AND t.date >= ? AND t.date <= ? AND t.status = 'completed' AND t.is_excluded = 0`;
  const expenses = db
    .prepare(
      `SELECT substr(t.date, 1, 10) as date, -t.charged_amount as amount, COALESCE(c.parent_id, c.id) as categoryId, t.description
       FROM category_transactions t LEFT JOIN categories c ON c.id = t.category_id
       WHERE ${where} AND t.kind = 'expense'`
    )
    .all(workspaceId, from, `${to}T23:59:59`) as RecapExpense[];
  const incomeRows = db
    .prepare(`SELECT substr(t.date, 1, 7) as month, SUM(t.charged_amount) as income FROM transactions t WHERE ${where} AND t.kind = 'income' GROUP BY month`)
    .all(workspaceId, from, `${to}T23:59:59`) as { month: string; income: number }[];
  const categories = db
    .prepare("SELECT id, name, need_type as needType FROM categories WHERE workspace_id = ?")
    .all(workspaceId) as RecapCategory[];
  // Top-level budgets only, so parents and children don't count twice.
  const topLevel = new Set((db.prepare("SELECT id FROM categories WHERE workspace_id = ? AND parent_id IS NULL").all(workspaceId) as { id: number }[]).map((r) => r.id));
  const budgetTotal = getAllBudgets(workspaceId).filter((b) => topLevel.has(b.categoryId)).reduce((s, b) => s + b.monthlyAmount, 0);

  const input = { expenses, income: Object.fromEntries(incomeRows.map((r) => [r.month, r.income])), categories, budgetTotal, today };
  return NextResponse.json(yearParam ? { mode: "year", recap: yearRecap(Number(yearParam), input) } : { mode: "month", recap: monthRecap(target, input) });
}
