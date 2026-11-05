import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { loadInsights } from "@/server/insights/data";
import { forecastCards } from "@/server/insights/forecast";
import { listAccountBalances } from "@/server/db/queries/assets";
import { getMonthlyAverages } from "@/server/db/queries/fi";
import { getPlan } from "@/server/db/queries/plan";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { israelToday } from "@/server/lib/date-utils";
import { cashAhead } from "@/lib/cash-ahead";

export const dynamic = "force-dynamic";

/** "Left to spend until payday": synced bank balance, minus card bills due first, plus salary still to come. */
export async function GET(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  const today = israelToday();
  const balances = listAccountBalances(ws);
  const i = loadInsights(ws, today, Number(process.env.CARD_BILLING_DAY) || 10);
  const bills = forecastCards({ today, cards: i.cards, series: i.series, installments: i.installments });
  const payday = getPlan(ws).monthStartDay;
  const { monthlyIncome } = getMonthlyAverages(ws);
  const monthStart = `${today.slice(0, 7)}-01`;
  const incomeSoFar = (getDb()
    .prepare(
      `SELECT COALESCE(SUM(charged_amount), 0) as total FROM transactions
       WHERE workspace_id = ? AND kind = 'income' AND status = 'completed' AND is_excluded = 0 AND date >= ? AND date <= ?`
    )
    .get(ws, monthStart, today) as { total: number }).total;

  return NextResponse.json(
    cashAhead({
      today,
      payday,
      bank: balances.length ? balances.reduce((s, b) => s + b.balance, 0) : null,
      bills: bills.map((b) => ({ date: b.date, total: b.total })),
      monthlyIncome,
      incomeSoFar,
    })
  );
}
