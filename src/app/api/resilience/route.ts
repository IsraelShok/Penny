import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { getMonthlyAverages } from "@/server/db/queries/fi";
import { getAssetsPayload } from "@/server/markets/portfolio";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { israelToday, addDays } from "@/server/lib/date-utils";
import { GET as getCashAhead } from "../cash-ahead/route";
import { resilience } from "@/lib/resilience";
import { ageOfMoney } from "@/lib/age-of-money";
import type { CashAhead } from "@/lib/cash-ahead";

export const dynamic = "force-dynamic";

const BASE = `workspace_id = ? AND status = 'completed' AND is_excluded = 0 AND date >= ?`;
const daysAgo = (today: string, n: number) => addDays(today, -n);

export const GET = handle("resilience", async (request: Request) => {
  const ws = getWorkspaceIdFromRequest(request);
  const today = israelToday();
  const db = getDb();
  const assets = await getAssetsPayload(ws);
  const { monthlyIncome, monthlyExpenses } = getMonthlyAverages(ws);
  const ahead = (await (await getCashAhead(request)).json()) as CashAhead;

  const thisMonth = `${today.slice(0, 7)}-01`;
  const sixAgo = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 7, 1);
  const months = db
    .prepare(
      `SELECT substr(date, 1, 7) as month,
         SUM(CASE WHEN kind = 'income' THEN charged_amount ELSE 0 END) as income,
         SUM(CASE WHEN kind = 'expense' THEN ABS(charged_amount) ELSE 0 END) as expenses
       FROM transactions WHERE ${BASE} AND date < ? GROUP BY month`,
    )
    .all(
      ws,
      `${sixAgo.getFullYear()}-${String(sixAgo.getMonth() + 1).padStart(2, "0")}-01`,
      thisMonth,
    ) as { income: number; expenses: number }[];

  // shortcut: overdraft interest is spotted by "ריבית" in the description; upgrade if banks expose a fee type.
  const overdraft = db
    .prepare(
      `SELECT 1 FROM transactions WHERE ${BASE} AND kind = 'expense' AND (description LIKE '%ריבית%' OR description LIKE '%overdraft%') LIMIT 1`,
    )
    .get(ws, daysAgo(today, 365));
  const debts = assets.assets.filter((a) => a.isLiability && a.type !== "mortgage");
  const costlyDebt = debts.some((a) => (a.interestRate ?? 0) > 8);

  const flows = db
    .prepare(
      `SELECT date, charged_amount as amount FROM transactions WHERE ${BASE} AND kind IN ('income', 'expense')`,
    )
    .all(ws, daysAgo(today, 90)) as { date: string; amount: number }[];

  return NextResponse.json({
    ...resilience({
      cash: assets.assets
        .filter((a) => a.type === "cash" || a.type === "deposit")
        .reduce((s, a) => s + (a.valueIls ?? 0), 0),
      monthlyIncome,
      monthlyExpenses,
      highInterestDebt: costlyDebt || overdraft ? true : debts.length ? false : null,
      goodMonths: months.filter((m) => m.income >= m.expenses).length,
      monthsCounted: months.length,
      freeToSpend: ahead.safeToSpend,
    }),
    ageOfMoney: ageOfMoney(flows),
  });
});
