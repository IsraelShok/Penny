import { NextResponse } from "next/server";
import {
  budgetToday,
  periodRange,
  previousPeriod,
  sameElapsed,
  samePeriodLastYear,
  shiftRange,
  PERIOD_MONTHS,
  type PeriodKind,
} from "@/lib/period";
import {
  getCategoryRows,
  getMonthlyFlow,
  getPeriodTotals,
  getSpendingTypeSplit,
} from "@/server/db/queries/overview";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { getPlan } from "@/server/db/queries/plan";
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

  const startDay = getPlan(workspaceId).monthStartDay;
  const today = budgetToday(new Date(), startDay);
  const cal = periodRange(kind, today, offset);
  // The current period is part-done: compare it with the same stretch of the others.
  const prev = shiftRange(
    offset === 0 ? sameElapsed(previousPeriod(cal), cal, today) : previousPeriod(cal),
    startDay,
  );
  const ly = shiftRange(
    offset === 0 ? sameElapsed(samePeriodLastYear(cal), cal, today) : samePeriodLastYear(cal),
    startDay,
  );
  const r = shiftRange(cal, startDay);
  const split = getSpendingTypeSplit(workspaceId, r);
  const payload: OverviewPayload = {
    period: {
      kind,
      year: r.year,
      startMonth: r.startMonth,
      from: r.from,
      to: r.to,
      months: r.months,
    },
    totals: getPeriodTotals(workspaceId, r),
    previous: getPeriodTotals(workspaceId, prev),
    lastYear: getPeriodTotals(workspaceId, ly),
    monthly: getMonthlyFlow(workspaceId, r, startDay),
    ...split,
    categories: getCategoryRows(workspaceId, r, prev, ly, startDay),
  };
  return NextResponse.json(payload);
}
