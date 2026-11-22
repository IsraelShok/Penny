import "server-only";

import crypto from "crypto";
import type Database from "better-sqlite3";

/**
 * Per-device tokens for phone quick-add. A token is 32 random bytes; only its SHA-256 is kept,
 * so a copied database does not hand out working tokens. Shown once, revocable one by one.
 */
const PREFIX = "pdt_";
const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export interface DeviceToken {
  id: number;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function createDeviceToken(db: Database.Database, ws: number, name: string) {
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new Error("name required");
  const token = PREFIX + crypto.randomBytes(32).toString("base64url");
  const id = Number(
    db
      .prepare("INSERT INTO device_tokens (workspace_id, name, token_hash) VALUES (?, ?, ?)")
      .run(ws, clean, hash(token)).lastInsertRowid,
  );
  return { id, token };
}

export function listDeviceTokens(db: Database.Database, ws: number): DeviceToken[] {
  return db
    .prepare(
      "SELECT id, name, created_at AS createdAt, last_used_at AS lastUsedAt FROM device_tokens WHERE workspace_id = ? ORDER BY id",
    )
    .all(ws) as DeviceToken[];
}

export function revokeDeviceToken(db: Database.Database, ws: number, id: number): boolean {
  return (
    db.prepare("DELETE FROM device_tokens WHERE workspace_id = ? AND id = ?").run(ws, id).changes >
    0
  );
}

/** The workspace an `Authorization: Bearer <token>` header belongs to, or null. */
export function verifyDeviceToken(
  db: Database.Database,
  authorization: string | null,
): { id: number; workspaceId: number } | null {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token || !token.startsWith(PREFIX) || token.length > 100) return null;
  // Lookup by hash of a 256-bit secret: timing of the index lookup reveals nothing usable.
  const row = db
    .prepare("SELECT id, workspace_id AS workspaceId FROM device_tokens WHERE token_hash = ?")
    .get(hash(token)) as { id: number; workspaceId: number } | undefined;
  if (!row) return null;
  db.prepare("UPDATE device_tokens SET last_used_at = datetime('now') WHERE id = ?").run(row.id);
  return row;
}
