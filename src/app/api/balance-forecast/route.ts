import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { loadInsights } from "@/server/insights/data";
import { forecastCards } from "@/server/insights/forecast";
import { listAccountBalances } from "@/server/db/queries/assets";
import { getMonthlyAverages } from "@/server/db/queries/fi";
import { getPlan } from "@/server/db/queries/plan";
import { isBankProvider } from "@/server/lib/transfers";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { israelToday } from "@/server/lib/date-utils";
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
  // Series carry the account number only; bank accounts are those whose transactions come from a bank provider.
  const bankAccounts = new Set(
    (getDb().prepare(`SELECT DISTINCT account_number as a, provider as p FROM transactions WHERE workspace_id = ?`).all(ws) as { a: string; p: string }[])
      .filter((r) => isBankProvider(r.p))
      .map((r) => r.a)
  );
  return NextResponse.json({
    forecast: forecastBalance({
      today,
      bank: balances.reduce((s, b) => s + b.balance, 0),
      payday: getPlan(ws).monthStartDay,
      monthlyIncome: getMonthlyAverages(ws).monthlyIncome,
      bills: bills.map((b) => ({ date: b.date, total: b.total })),
      recurring: i.series
        .filter((s) => s.status === "suggested" && bankAccounts.has(s.account))
        .map((s) => ({ cadence: s.cadence, lastDate: s.lastDate, amount: s.expectedAmount })),
    }),
  });
}
