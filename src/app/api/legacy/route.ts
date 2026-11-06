import { NextResponse } from "next/server";
import { getDb } from "@/server/db/index";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { EMPTY_NOTES, parseLegacyNotes } from "@/lib/legacy";

/** The family document's free-text notes for this workspace. */
export async function GET(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const row = getDb().prepare("SELECT data FROM legacy_notes WHERE workspace_id = ?").get(workspaceId) as { data: string } | undefined;
  try {
    return NextResponse.json(row ? parseLegacyNotes(JSON.parse(row.data)) : EMPTY_NOTES);
  } catch {
    return NextResponse.json(EMPTY_NOTES);
  }
}

export async function PUT(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  let notes;
  try {
    notes = parseLegacyNotes(await request.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "invalid" }, { status: 400 });
  }
  getDb()
    .prepare(
      `INSERT INTO legacy_notes (workspace_id, data) VALUES (?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`
    )
    .run(workspaceId, JSON.stringify(notes));
  return NextResponse.json(notes);
}
