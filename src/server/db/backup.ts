import "server-only";

import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";
import { dataDir } from "../lib/data-dir";

const KEEP_BACKUPS = 5;

export function backupDir(): string {
  return path.join(dataDir(), "backups");
}

/**
 * Copies the database before a migration touches it. VACUUM INTO writes a consistent snapshot even
 * while another connection (the MCP reader, a second process) has the file open; a raw file copy does not.
 * Returns the backup path, or null when there is nothing to back up yet.
 */
export function backupBeforeMigration(db: Database.Database, reason: string): string | null {
  const dbPath = path.join(dataDir(), "penny.db");
  if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) return null;

  // A first run has only the migration bookkeeping table, so there is nothing worth copying yet.
  const userTables = db
    .prepare(
      "SELECT COUNT(*) as n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_migrations'",
    )
    .get() as { n: number };
  if (userTables.n === 0) return null;

  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(dir, `penny-${stamp}-${reason}.db`);
  snapshotTo(db, target);

  pruneBackups(dir);
  console.log(`[db] backed up before ${reason}: ${target}`);
  return target;
}

/**
 * Writes a consistent copy of the database to target. VACUUM INTO refuses a damaged file ("database disk
 * image is malformed"), and that is exactly the file a restore must be able to replace, so it falls back
 * to folding the WAL in and copying the file as it is.
 */
export function snapshotTo(db: Database.Database, target: string): void {
  try {
    db.prepare("VACUUM INTO ?").run(target);
  } catch (e) {
    console.warn("[db] VACUUM INTO failed, copying the file as it is:", e);
    fs.rmSync(target, { force: true });
    try {
      db.pragma("wal_checkpoint(TRUNCATE)");
    } catch {
      // A damaged file may refuse the checkpoint too; the copy below is still the best we have.
    }
    fs.copyFileSync(db.name, target);
  }
}

function pruneBackups(dir: string): void {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("penny-") && f.endsWith(".db"))
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const { f } of files.slice(KEEP_BACKUPS)) {
    fs.rmSync(path.join(dir, f), { force: true });
    // The key that was live when a pre-restore copy was taken (see applyBackup).
    fs.rmSync(path.join(dir, `${f}.key`), { force: true });
  }
}
