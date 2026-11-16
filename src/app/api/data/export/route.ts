import { NextResponse } from "next/server";
import { getDb } from "@/server/db/index";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { toCsv } from "@/lib/csv";

const HEADERS = [
  "date",
  "processed_date",
  "account",
  "provider",
  "description",
  "memo",
  "original_amount",
  "original_currency",
  "charged_amount",
  "charged_currency",
  "kind",
  "status",
  "category",
  "owner",
  "tags",
  // Every in-app total hides excluded rows, so the export has to say which ones they are.
  "excluded",
];

/** All transactions of the workspace as a CSV download. */
export async function GET(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const rows = getDb()
    .prepare(
      `SELECT t.date, t.processed_date, t.account_number AS account, t.provider, t.description, t.memo,
              t.original_amount, t.original_currency, t.charged_amount, t.charged_currency,
              t.kind, t.status, COALESCE(c.name, '') as category, COALESCE(t.owner, '') as owner,
              (SELECT group_concat(tag, '|') FROM transaction_tags tt WHERE tt.transaction_id = t.id) as tags,
              t.is_excluded AS excluded
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.workspace_id = ?
       ORDER BY t.date, t.id`
    )
    .all(workspaceId) as Record<string, unknown>[];

  const csv = toCsv([
    HEADERS,
    ...rows.map((row) => HEADERS.map((h) => row[h] as string | number | null)),
  ]);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      // The BOM keeps Hebrew readable when Excel opens the file by double-click.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="penny-transactions-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
