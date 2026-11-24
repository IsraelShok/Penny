import type Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { AVATAR_ART } from "@/lib/profile-avatar";

export const PROFILES_MIGRATION = "046_profiles.sql";

// Seeded or derived on workspace creation; rows here alone don't make a workspace "have data".
const NOT_DATA = new Set([
  "categories",
  "workspace_settings",
  "synced_preferences",
  "net_worth_daily",
  "profiles",
  "workspace_members",
  "access_audit",
  "control_audit",
]);

export type ProfilesReport = {
  household: number;
  profiles: { workspaceId: number; profileId: number; name: string }[];
  keptHidden: { workspaceId: number; name: string; rows: Record<string, number> }[];
};

/** Rows per table (with any rows) that belong to a workspace, excluding seeded/derived tables. */
function workspaceDataCounts(db: Database.Database, workspaceId: number): Record<string, number> {
  const tables = (
    db
      .prepare(
        "SELECT m.name FROM sqlite_master m WHERE m.type='table' AND EXISTS (SELECT 1 FROM pragma_table_info(m.name) WHERE name='workspace_id')",
      )
      .all() as { name: string }[]
  ).map((r) => r.name);
  const counts: Record<string, number> = {};
  for (const t of tables) {
    if (NOT_DATA.has(t)) continue;
    const n = (
      db.prepare(`SELECT COUNT(*) AS n FROM "${t}" WHERE workspace_id = ?`).get(workspaceId) as {
        n: number;
      }
    ).n;
    if (n) counts[t] = n;
  }
  return counts;
}

/**
 * One-time and idempotent (no-op once any profile exists): the lowest-id workspace becomes the household.
 * It and every empty workspace become profiles of it, carrying name, avatar and synced UI prefs.
 * Workspaces with their own data are never touched: they stay intact, hidden, and are reported.
 */
export function seedProfiles(db: Database.Database): ProfilesReport | null {
  if ((db.prepare("SELECT COUNT(*) AS n FROM profiles").get() as { n: number }).n > 0) return null;
  const workspaces = db
    .prepare("SELECT id, name, avatar_emoji, avatar_color FROM workspaces ORDER BY id")
    .all() as {
    id: number;
    name: string;
    avatar_emoji: string | null;
    avatar_color: string | null;
  }[];
  if (!workspaces.length) return null;
  const household = workspaces[0].id;
  const report: ProfilesReport = { household, profiles: [], keptHidden: [] };
  const insert = db.prepare(
    "INSERT INTO profiles (workspace_id, name, avatar_emoji, avatar_color) VALUES (?, ?, ?, ?)",
  );
  const copyPrefs = db.prepare(
    "INSERT OR IGNORE INTO synced_preferences (workspace_id, profile, key, value, revision) SELECT ?, ?, key, value, 1 FROM synced_preferences WHERE workspace_id = ? AND profile = 'local'",
  );
  db.transaction(() => {
    for (const ws of workspaces) {
      const rows = ws.id === household ? {} : workspaceDataCounts(db, ws.id);
      if (Object.keys(rows).length) {
        report.keptHidden.push({ workspaceId: ws.id, name: ws.name, rows });
        continue;
      }
      // Keep the look the UI derived from the workspace id when no avatar was picked.
      const emoji =
        ws.avatar_emoji ??
        (ws.avatar_color ? null : `@${AVATAR_ART[Math.abs(ws.id - 1) % AVATAR_ART.length]}`);
      const id = Number(insert.run(household, ws.name, emoji, ws.avatar_color).lastInsertRowid);
      copyPrefs.run(household, `p${id}`, ws.id);
      report.profiles.push({ workspaceId: ws.id, profileId: id, name: ws.name });
    }
  })();
  return report;
}

/** Consistent copy of the live DB next to it, before the profiles migration touches anything. */
export function backupBeforeProfiles(db: Database.Database): string | null {
  if (!db.name || db.memory) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(
    path.dirname(db.name),
    `${path.basename(db.name)}.${stamp}.before-profiles.bak`,
  );
  db.prepare("VACUUM INTO ?").run(target);
  return target;
}

export function writeProfilesReport(
  db: Database.Database,
  report: ProfilesReport,
  backup: string | null,
): void {
  console.info("[profiles migration]", JSON.stringify({ ...report, backup }));
  if (!db.name || db.memory) return;
  try {
    fs.writeFileSync(
      path.join(path.dirname(db.name), "profiles-migration-report.json"),
      JSON.stringify({ ...report, backup, at: new Date().toISOString() }, null, 2),
    );
  } catch {
    /* the console line above still records it */
  }
}
