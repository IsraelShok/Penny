import { NextResponse } from "next/server";
import { getTagRows } from "@/server/db/queries/transactions";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { tagBreakdown, tagTotals } from "@/lib/tags";

/** All tags with totals; `?tag=X` adds that tag's category breakdown. */
export async function GET(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const tag = new URL(request.url).searchParams.get("tag");
  const rows = getTagRows(workspaceId);
  return NextResponse.json({ tags: tagTotals(rows), breakdown: tag ? tagBreakdown(rows, tag) : [] });
}
