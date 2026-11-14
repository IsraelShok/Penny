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

export function dbPath(dir = dataDir()): string {
  return preferExisting(path.join(dir, "penny.db"), path.join(dir, "spent.db")); // legacy: spent.db from installs before the Penny rename
}
