import { NextResponse } from "next/server";
import { loadInsights } from "@/server/insights/data";
import { forecastCards } from "@/server/insights/forecast";
import { listAccountBalances } from "@/server/db/queries/assets";
import { getMonthlyAverages } from "@/server/db/queries/fi";
import { getPlan } from "@/server/db/queries/plan";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { israelToday } from "@/server/lib/date-utils";
import { bankObligations } from "@/server/insights/obligations";
import { addDays } from "@/lib/balance-forecast";
import { forecastBalance } from "@/lib/balance-forecast";

export const dynamic = "force-dynamic";

/** 90-day bank balance: synced balance, salary on payday, card bills and recurring bank debits. */
export async function GET(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  const today = israelToday();
  const balances = listAccountBalances(ws);
  if (!balances.length) return NextResponse.json({ forecast: null });
  const i = loadInsights(ws, today, Number(process.env.CARD_BILLING_DAY) || 10);
  const bills = forecastCards({ today, cards: i.cards, series: i.series, installments: i.installments });
  return NextResponse.json({
    forecast: forecastBalance({
      today,
      bank: balances.reduce((s, b) => s + b.balance, 0),
      payday: getPlan(ws).monthStartDay,
      monthlyIncome: getMonthlyAverages(ws).monthlyIncome,
      bills: bills.map((b) => ({ date: b.date, total: b.total })),
      recurring: [],
      scheduled: bankObligations(ws,i.series,addDays(today,1),addDays(today,90)),
    }),
  });
}
