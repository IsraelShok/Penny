import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { getDb } from "@/server/db/index";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";

const CONFIRM_DELETE_ALL = "delete-all-transactions";

export const DELETE = handle("data/transactions", async (request: Request) => {
  // Destructive and unrecoverable: refuse unless the caller explicitly confirms (the settings dialog does).
  const confirm = ((await request.json().catch(() => null)) as { confirm?: unknown } | null)
    ?.confirm;
  if (confirm !== CONFIRM_DELETE_ALL)
    return NextResponse.json({ error: "confirm" }, { status: 400 });
  const workspaceId = getWorkspaceIdFromRequest(request);
  const db = getDb();

  const result = db.transaction(() => {
    const txCount = (
      db
        .prepare("SELECT COUNT(*) as c FROM transactions WHERE workspace_id = ?")
        .get(workspaceId) as { c: number }
    ).c;
    const syncCount = (
      db.prepare("SELECT COUNT(*) as c FROM sync_runs WHERE workspace_id = ?").get(workspaceId) as {
        c: number;
      }
    ).c;
    const memoryCount = (
      db
        .prepare("SELECT COUNT(*) as c FROM merchant_categories WHERE workspace_id = ?")
        .get(workspaceId) as { c: number }
    ).c;

    db.prepare("DELETE FROM transactions WHERE workspace_id = ?").run(workspaceId);
    db.prepare("DELETE FROM sync_runs WHERE workspace_id = ?").run(workspaceId);
    db.prepare("DELETE FROM merchant_categories WHERE workspace_id = ?").run(workspaceId);

    return { txCount, syncCount, memoryCount };
  })();

  return NextResponse.json({
    success: true,
    deleted: result,
  });
});
