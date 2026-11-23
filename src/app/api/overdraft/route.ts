import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { listAccountBalances } from "@/server/db/queries/assets";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { israelToday } from "@/server/lib/date-utils";
import { overdraftCost, type OverdraftTxn } from "@/lib/overdraft";

export const dynamic = "force-dynamic";

/** Overdraft interest paid in the last 12 months, and today's bank balance. */
export const GET = handle("overdraft", async (request: Request) => {
  const ws = getWorkspaceIdFromRequest(request);
  const today = israelToday();
  const since = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const txns = getDb()
    .prepare(
      `SELECT date, description, charged_amount as amount FROM transactions
       WHERE workspace_id = ? AND status = 'completed' AND date > ? AND description LIKE '%ריבית%'`,
    )
    .all(ws, since) as OverdraftTxn[];
  const balances = listAccountBalances(ws);
  return NextResponse.json({
    ...overdraftCost(txns, today),
    balance: balances.length ? balances.reduce((s, b) => s + b.balance, 0) : null,
  });
});
