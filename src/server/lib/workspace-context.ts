import "server-only";

import { accessEnabled, currentUser, membership, defaultWorkspace } from "./user-access";
import { getDb } from "../db";

const HEADER = "x-workspace-id";

export function hasWorkspaceHeader(req: Request): boolean {
  return req.headers.get(HEADER) != null;
}

export function getWorkspaceIdFromRequest(req: Request): number {
  if (accessEnabled()) {
    const user = currentUser(req);
    if (!user) throw new Error("Authentication required");
    const raw = req.headers.get(HEADER),
      id = !raw ? defaultWorkspace(user) : Number(raw);
    if (
      !id ||
      !Number.isSafeInteger(id) ||
      !membership(user, id) ||
      !getDb().prepare("SELECT 1 FROM workspaces WHERE id=?").get(id)
    )
      throw new Error("Workspace access denied");
    return id;
  }
  const header = req.headers.get(HEADER);
  if (header) {
    const id = Number(header);
    if (Number.isInteger(id) && id > 0) {
      const row = getDb().prepare("SELECT id FROM workspaces WHERE id = ?").get(id) as
        { id: number } | undefined;
      if (row) return row.id;
    }
  }
  const row = getDb().prepare("SELECT id FROM workspaces ORDER BY id LIMIT 1").get() as
    { id: number } | undefined;
  if (!row) {
    throw new Error("No workspace exists. Migration 013_workspaces did not run.");
  }
  return row.id;
}

export function listAllWorkspaceIds(): number[] {
  return (getDb().prepare("SELECT id FROM workspaces ORDER BY id").all() as { id: number }[]).map(
    (r) => r.id,
  );
}
