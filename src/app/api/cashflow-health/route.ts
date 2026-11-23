import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { getAssetsPayload } from "@/server/markets/portfolio";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { israelToday } from "@/server/lib/date-utils";
import { liquidCash } from "@/lib/allocation";
import { cashflowLevel, cashflowSigns, type CashflowFacts } from "@/lib/cashflow-health";

export const dynamic = "force-dynamic";

const BASE = `workspace_id = ? AND status = 'completed' AND is_excluded = 0 AND date >= date(?, ?)`;
// shortcut: signs are spotted by Hebrew/English description words; upgrade if banks expose a fee or loan type.
const OVERDRAFT = `(description LIKE '%ריבית חובה%' OR description LIKE '%ריבית על יתרת חובה%' OR description LIKE '%משיכת יתר%' OR description LIKE '%overdraft%')`;
const LOAN_IN = `(description LIKE '%הלוואה%' OR description LIKE '%loan%')`;
const LATE = `(description LIKE '%פיגור%' OR description LIKE '%החזרת חיוב%' OR description LIKE '%חזרת שיק%' OR description LIKE '%חזרת הוראת%' OR description LIKE '%late fee%')`;

export const GET = handle("cashflow-health", async (request: Request) => {
  const ws = getWorkspaceIdFromRequest(request);
  const today = israelToday();
  const db = getDb();
  const one = <T>(sql: string, ...args: unknown[]) => db.prepare(sql).get(ws, today, ...args) as T;

  const overdraft = one<{ n: number }>(
    `SELECT COUNT(DISTINCT substr(date, 1, 7)) as n FROM transactions WHERE ${BASE} AND kind = 'expense' AND ${OVERDRAFT}`,
    "-3 months",
  );
  const inst = one<{ inst: number | null; total: number | null }>(
    `SELECT SUM(CASE WHEN type = 'installments' THEN -charged_amount END) as inst, SUM(-charged_amount) as total FROM transactions WHERE ${BASE} AND kind = 'expense'`,
    "-90 days",
  );
  const loans = one<{ n: number }>(
    `SELECT COUNT(*) as n FROM transactions WHERE ${BASE} AND kind IN ('income', 'transfer') AND charged_amount > 0 AND ${LOAN_IN}`,
    "-6 months",
  );
  const late = one<{ n: number }>(
    `SELECT COUNT(*) as n FROM transactions WHERE ${BASE} AND kind = 'expense' AND ${LATE}`,
    "-6 months",
  );
  const months = db
    .prepare(
      `SELECT substr(date, 1, 7) as m,
         SUM(CASE WHEN kind = 'income' THEN charged_amount ELSE 0 END) as income,
         SUM(CASE WHEN kind = 'expense' THEN -charged_amount ELSE 0 END) as expenses
       FROM transactions WHERE ${BASE} AND date < date(?, 'start of month') GROUP BY m`,
    )
    .all(ws, today, "-3 months", today) as { income: number; expenses: number }[];
  const assets = await getAssetsPayload(ws);
  const liquid = liquidCash(assets.assets);

  const facts: CashflowFacts = {
    overdraftMonths: overdraft.n,
    installmentShare: inst.total ? (inst.inst ?? 0) / inst.total : 0,
    newLoans: loans.n,
    lateFees: late.n,
    liquid,
    deficitMonths: months.filter((m) => m.expenses > m.income).length,
  };
  const signs = cashflowSigns(facts);
  // No transactions yet means nothing to judge.
  const hasData = months.length > 0 || (inst.total ?? 0) > 0;
  const avg = (key: "income" | "expenses") =>
    months.length ? months.reduce((s, m) => s + m[key], 0) / months.length : 0;
  return NextResponse.json({
    hasData,
    facts,
    signs,
    level: cashflowLevel(signs),
    avgIncome: avg("income"),
    avgExpenses: avg("expenses"),
  });
});
