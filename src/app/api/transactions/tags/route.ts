import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { deleteTag, getTagRows, renameTag } from "@/server/db/queries/transactions";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { normalizeTag, tagBreakdown, tagTotals } from "@/lib/tags";

/** All tags with totals; `?tag=X` adds that tag's category breakdown. */
export const GET = handle("transactions/tags", async (request: Request) => {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const tag = new URL(request.url).searchParams.get("tag");
  const rows = getTagRows(workspaceId);
  return NextResponse.json({
    tags: tagTotals(rows),
    breakdown: tag ? tagBreakdown(rows, tag) : [],
  });
});

/** Rename a tag everywhere: { from, to }. */
export const PATCH = handle("transactions/tags", async (request: Request) => {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as { from?: unknown; to?: unknown } | null;
  const from = normalizeTag(body?.from),
    to = normalizeTag(body?.to);
  if (!from || !to) return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  return NextResponse.json({ changed: from === to ? 0 : renameTag(workspaceId, from, to) });
});

/** Remove a tag from every transaction: ?tag=X. */
export const DELETE = handle("transactions/tags", async (request: Request) => {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const tag = normalizeTag(new URL(request.url).searchParams.get("tag"));
  if (!tag) return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  return NextResponse.json({ removed: deleteTag(workspaceId, tag) });
});
