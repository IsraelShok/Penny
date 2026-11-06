import { NextResponse } from "next/server";
import { countStoredForImport, deleteFileImport, insertFileImport } from "@/server/db/queries/transactions";
import { applyMerchantRulesToSyncRun } from "@/server/db/queries/excluded-merchants";
import { applyRulesToSyncRun } from "@/server/db/queries/rules";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { markDuplicates, MAX_IMPORT_ROWS, parseImportDate, type ImportRow } from "@/lib/file-import";

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

/**
 * Imports parsed statement rows: { account, rows: [{date, description, amount}], dryRun? }.
 * Rows already stored for that account are skipped. dryRun only counts.
 */
export async function POST(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const body = (await request.json().catch(() => ({}))) as { account?: unknown; rows?: unknown; dryRun?: unknown };
  const account = typeof body.account === "string" ? body.account.trim().slice(0, 40) : "";
  if (!account) return bad("account is required");
  if (!Array.isArray(body.rows) || body.rows.length === 0) return bad("rows are required");
  if (body.rows.length > MAX_IMPORT_ROWS) return bad(`at most ${MAX_IMPORT_ROWS} rows`);
  const rows: ImportRow[] = [];
  for (const r of body.rows as Record<string, unknown>[]) {
    const date = typeof r?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? parseImportDate(r.date) : null;
    const amount = r?.amount;
    const description = typeof r?.description === "string" ? r.description.trim().slice(0, 200) : "";
    if (!date || date > "2100-01-01" || date < "1990-01-01") return bad("invalid date");
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1e8) return bad("invalid amount");
    if (!description) return bad("invalid description");
    rows.push({ date, description, amount: Math.round(amount * 100) / 100 });
  }
  const dates = rows.map((r) => r.date).sort();
  const marked = markDuplicates(rows, countStoredForImport(workspaceId, account, dates[0], dates[dates.length - 1]));
  const fresh = marked.filter((r) => !r.duplicate);
  const duplicates = marked.length - fresh.length;
  if (body.dryRun === true || fresh.length === 0) return NextResponse.json({ ready: fresh.length, duplicates, added: 0, batchId: null });

  const { batchId, added } = insertFileImport(workspaceId, account, fresh);
  // Same merchant memory and rules a bank sync gets, so categories are remembered.
  applyMerchantRulesToSyncRun(workspaceId, batchId);
  applyRulesToSyncRun(workspaceId, batchId);
  return NextResponse.json({ ready: fresh.length, duplicates: duplicates + fresh.length - added, added, batchId });
}

/** Undo one import: ?batch=. */
export async function DELETE(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const batch = Number(new URL(request.url).searchParams.get("batch"));
  if (!Number.isInteger(batch) || batch <= 0) return bad("invalid batch");
  return NextResponse.json({ removed: deleteFileImport(workspaceId, batch) });
}
