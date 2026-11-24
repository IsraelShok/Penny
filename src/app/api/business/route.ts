import { handle } from "@/server/lib/api-error";
import { israelToday, monthKey } from "@/server/lib/date-utils";
import { NextResponse } from "next/server";
import { getBusinessReport } from "@/server/db/queries/business";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { toCsv } from "@/lib/csv";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Default period: the last twelve months, ending today. */
function defaultRange(today = israelToday()): { from: string; to: string } {
  return { from: `${monthKey(today, -11)}-01`, to: today };
}

/** The business share of the ledger, as JSON or as a CSV for an accountant. */
export const GET = handle("business", async (request: Request) => {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const q = new URL(request.url).searchParams;
  const fallback = defaultRange();
  const from = ISO.test(q.get("from") ?? "") ? q.get("from")! : fallback.from;
  const to = ISO.test(q.get("to") ?? "") ? q.get("to")! : fallback.to;
  if (from > to) return NextResponse.json({ error: "from must be before to" }, { status: 400 });

  const report = getBusinessReport(workspaceId, from, to);
  if (q.get("format") !== "csv") return NextResponse.json(report);

  const csv = toCsv([
    ["תאריך", "תיאור", "חשבון", "קטגוריה", "סכום שחויב", "חלק עסקי", "אחוז עסקי"],
    ...report.rows.map((r) => [
      r.date,
      r.description,
      r.account,
      r.category,
      r.charged,
      r.business,
      r.pct,
    ]),
    [],
    ['סה"כ', "", "", "", "", report.expenses - report.income, ""],
  ]);
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="penny-business-${from}-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
