import { NextResponse } from "next/server";
import { getMonthlyIncomes } from "@/server/db/queries/budgets";
import { getAppSettings } from "@/server/db/queries/settings";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { smoothIncome } from "@/lib/smoothing";

export const dynamic = "force-dynamic";

/** Steady monthly amount for irregular income; null when income is steady. */
export async function GET(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  const { past, current } = getMonthlyIncomes(ws);
  return NextResponse.json({ smoothing: smoothIncome(past, current, getAppSettings(ws).household.incomeShape) });
}
