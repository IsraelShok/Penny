import { NextResponse } from "next/server";
import { periodRange, previousPeriod, sameElapsed, samePeriodLastYear, PERIOD_MONTHS, type PeriodKind } from "@/lib/period";
import {
  getCategoryRows,
  getMonthlyFlow,
  getPeriodTotals,
  getSpendingTypeSplit,
} from "@/server/db/queries/overview";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import type { OverviewPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const params = new URL(request.url).searchParams;
  const kind = (params.get("period") ?? "quarter") as PeriodKind;
  const offset = Number(params.get("offset") ?? 0);
  if (!(kind in PERIOD_MONTHS) || !Number.isInteger(offset) || offset < 0 || offset > 120) {
    return NextResponse.json({ error: "invalid period or offset" }, { status: 400 });
  }

  const today = new Date();
  const r = periodRange(kind, today, offset);
  // The current period is part-done: compare it with the same stretch of the others.
  const prev = offset === 0 ? sameElapsed(previousPeriod(r), r, today) : previousPeriod(r);
  const ly = offset === 0 ? sameElapsed(samePeriodLastYear(r), r, today) : samePeriodLastYear(r);
  const split = getSpendingTypeSplit(workspaceId, r);
  const payload: OverviewPayload = {
    period: { kind, year: r.year, startMonth: r.startMonth, from: r.from, to: r.to, months: r.months },
    totals: getPeriodTotals(workspaceId, r),
    previous: getPeriodTotals(workspaceId, prev),
    lastYear: getPeriodTotals(workspaceId, ly),
    monthly: getMonthlyFlow(workspaceId, r),
    ...split,
    categories: getCategoryRows(workspaceId, r, prev, ly),
  };
  return NextResponse.json(payload);
}
