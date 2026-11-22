import "server-only";

import path from "path";
import { pennyEnv } from "@/lib/legacy-names";

/** Where the database and the encryption key live: PENNY_DATA_DIR, or ./data. */
export function dataDir(): string {
  const dir = pennyEnv("DATA_DIR");
  if (dir) return path.resolve(dir);
  // Vercel: only /tmp is writable. Each new instance seeds a fresh demo household there.
  if (process.env.VERCEL) return "/tmp/penny-demo";
  return path.join(process.cwd(), "data");
}

export function dbPath(dir = dataDir()): string {
  return path.join(dir, "penny.db");
}
