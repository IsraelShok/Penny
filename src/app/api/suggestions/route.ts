import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { buildSuggestions, type Suggestion, type SuggestionTxn } from "@/lib/suggestions";
import { loadInsights } from "@/server/insights/data";
import { listPolicies, getPlan } from "@/server/db/queries/plan";
import { listAssets } from "@/server/db/queries/assets";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { toLocalISODate } from "@/server/lib/date-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  const db = getDb();
  const today = toLocalISODate(new Date());
  const since = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const txns = db
    .prepare(
      `SELECT t.date, t.description, t.charged_amount as amount, t.kind, c.name as categoryName
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.workspace_id = ? AND t.date >= ? AND t.status = 'completed' AND t.is_excluded = 0`
    )
    .all(ws, since) as SuggestionTxn[];
  const dismissed = new Set(
    (db.prepare("SELECT key FROM dismissed_suggestions WHERE workspace_id = ?").all(ws) as { key: string }[]).map((r) => r.key)
  );
  const known = [...listPolicies(ws).map((p) => p.name), ...listAssets(ws).map((a) => a.name)].map((n) => n.toLowerCase());
  const priceChanges = loadInsights(ws, today)
    .series.filter((s) => s.status === "suggested" && s.priceChange)
    .map((s) => ({ merchant: s.merchant, from: s.priceChange!.from, to: s.priceChange!.to }));
  const suggestions: Suggestion[] = buildSuggestions(txns, { today, known, monthStartDay: getPlan(ws).monthStartDay, priceChanges })
    .filter((s) => !dismissed.has(s.key));
  return NextResponse.json({ suggestions });
}

/** Body: { key } — hides a suggestion for good. */
export async function POST(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.slice(0, 300) : "";
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });
  getDb().prepare("INSERT OR IGNORE INTO dismissed_suggestions (workspace_id, key) VALUES (?, ?)").run(ws, key);
  return NextResponse.json({ success: true });
}
