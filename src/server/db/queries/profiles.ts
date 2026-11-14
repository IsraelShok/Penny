import "server-only";

import { getDb } from "../index";
import type { Profile } from "@/lib/types";
import { parsePip, type AvatarInput, type ProfilePip } from "@/lib/profile-avatar";

type Row = { id: number; workspace_id: number; name: string; avatar_emoji: string | null; avatar_color: string | null; avatar_pet: string | null; created_at: string };
const COLS = "id, workspace_id, name, avatar_emoji, avatar_color, avatar_pet, created_at";
const map = (r: Row): Profile => ({ id: r.id, workspaceId: r.workspace_id, name: r.name, avatarEmoji: r.avatar_emoji, avatarColor: r.avatar_color, avatarPet: readPip(r.avatar_pet), createdAt: r.created_at });

/** Stored JSON; anything unreadable is treated as no Pip. */
function readPip(json: string | null): ProfilePip | null {
  try { return json ? parsePip(JSON.parse(json)) : null; } catch { return null; }
}
const pipJson = (p: ProfilePip | null | undefined) => (p ? JSON.stringify(p) : null);

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Profile name is required");
  if (trimmed.length > 60) throw new Error("Profile name too long");
  return trimmed;
}

/** Profiles of every household; in practice one household. Workspaces without profiles stay hidden. */
export function listProfiles(): Profile[] {
  return (getDb().prepare(`SELECT ${COLS} FROM profiles ORDER BY id`).all() as Row[]).map(map);
}

export function getProfile(id: number): Profile | null {
  const row = getDb().prepare(`SELECT ${COLS} FROM profiles WHERE id = ?`).get(id) as Row | undefined;
  return row ? map(row) : null;
}

/** The household new profiles join: the one existing profiles share (lowest workspace as a fallback). */
export function householdId(): number {
  const row = getDb().prepare("SELECT workspace_id AS id FROM profiles ORDER BY id LIMIT 1").get() as { id: number } | undefined;
  return row?.id ?? (getDb().prepare("SELECT MIN(id) AS id FROM workspaces").get() as { id: number }).id;
}

export function createProfile(name: string, avatar: AvatarInput = {}): Profile {
  const result = getDb()
    .prepare("INSERT INTO profiles (workspace_id, name, avatar_emoji, avatar_color, avatar_pet) VALUES (?, ?, ?, ?, ?)")
    .run(householdId(), cleanName(name), avatar.avatarEmoji ?? null, avatar.avatarColor ?? null, pipJson(avatar.avatarPet));
  return getProfile(Number(result.lastInsertRowid))!;
}

export function updateProfile(id: number, name: string, avatar: AvatarInput = {}): Profile {
  const existing = getProfile(id);
  if (!existing) throw new Error("Profile not found");
  getDb()
    .prepare("UPDATE profiles SET name = ?, avatar_emoji = ?, avatar_color = ?, avatar_pet = ? WHERE id = ?")
    .run(
      cleanName(name),
      avatar.avatarEmoji !== undefined ? avatar.avatarEmoji : existing.avatarEmoji,
      avatar.avatarColor !== undefined ? avatar.avatarColor : existing.avatarColor,
      pipJson(avatar.avatarPet !== undefined ? avatar.avatarPet : existing.avatarPet),
      id
    );
  return getProfile(id)!;
}

/** Removes the profile and its UI preferences only; household data is never touched. */
export function deleteProfile(id: number): void {
  const p = getProfile(id);
  if (!p) throw new Error("Profile not found");
  const db = getDb();
  const left = (db.prepare("SELECT COUNT(*) AS n FROM profiles WHERE workspace_id = ?").get(p.workspaceId) as { n: number }).n;
  if (left <= 1) throw new Error("Cannot delete the only profile");
  db.transaction(() => {
    db.prepare("DELETE FROM synced_preferences WHERE workspace_id = ? AND profile = ?").run(p.workspaceId, `p${id}`);
    db.prepare("DELETE FROM profiles WHERE id = ?").run(id);
  })();
}

/** The profile named by the X-Profile-ID header, if it belongs to this household. */
export function profileFromRequest(req: Request, workspaceId: number): Profile | null {
  const id = Number(req.headers.get("x-profile-id"));
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const p = getProfile(id);
  return p && p.workspaceId === workspaceId ? p : null;
}
