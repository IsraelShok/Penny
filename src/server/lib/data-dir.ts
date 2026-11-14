import "server-only";

import fs from "fs";
import path from "path";
import { pennyEnv } from "@/lib/legacy-names";

/** Where the database and the encryption key live: PENNY_DATA_DIR, or ./data. */
export function dataDir(): string {
  const dir = pennyEnv("DATA_DIR");
  return dir ? path.resolve(dir) : path.join(process.cwd(), "data");
}

/** The new name unless only the old one exists, so existing data keeps being found. */
export function preferExisting(preferred: string, legacy: string): string {
  return !fs.existsSync(preferred) && fs.existsSync(legacy) ? legacy : preferred;
}

/**
 * Renames a pre-rename spent.db (with its -wal/-shm) to penny.db when only the old one exists.
 * If any rename fails (e.g. the file is open on Windows), undoes the ones done and keeps using spent.db.
 */
export function migrateLegacyDb(dir: string): string {
  const next = path.join(dir, "penny.db");
  const old = path.join(dir, "spent.db"); // legacy: spent.db from installs before the Penny rename
  if (preferExisting(next, old) === next) return next;
  const done: [string, string][] = [];
  try {
    // sidecars first, main file last, so penny.db never appears without its WAL
    for (const suffix of ["-wal", "-shm", ""]) {
      if (!fs.existsSync(old + suffix)) continue;
      fs.renameSync(old + suffix, next + suffix);
      done.push([old + suffix, next + suffix]);
    }
    console.log(`[penny] Renamed ${old} to ${next}`);
    return next;
  } catch (err) {
    for (const [from, to] of done.reverse()) fs.renameSync(to, from);
    console.warn(`[penny] Could not rename ${old}, using it as is:`, err);
    return old;
  }
}

export function dbPath(dir = dataDir()): string {
  return migrateLegacyDb(dir);
}
