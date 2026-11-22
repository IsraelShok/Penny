import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { checkSecret, endAllSessions, isLockEnabled, shred } from "@/server/lib/app-lock";
import { keyPath, legacyKeyPath, lockFilePath, setKeyInMemory } from "@/server/lib/encryption";
import { dataDir } from "@/server/lib/data-dir";
import { withSession } from "../../lock/session-cookie";

export const dynamic = "force-dynamic";

// The typed confirmation word, in either UI language.
const WIPE_WORDS = ["מחיקה", "delete"];

/** Deletes everything: the database (credentials, settings, AI keys, Telegram), the key or wrapped key, and logs. Back to first run. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    confirm?: unknown;
    secret?: unknown;
  } | null;
  const confirm = body?.confirm;
  const secret = body?.secret;
  if (typeof confirm !== "string" || !WIPE_WORDS.includes(confirm.trim().toLowerCase()))
    return NextResponse.json({ error: "confirm" }, { status: 400 });
  if (isLockEnabled()) {
    const check = await checkSecret(secret);
    if (!check.ok)
      return NextResponse.json(
        { error: check.reason, retryAfter: check.retryAfter },
        { status: check.reason === "wait" ? 429 : 401 },
      );
  }

  // Stop background work that holds the bot token or would write to the database mid-wipe.
  const bot = globalThis.__pennyBot;
  globalThis.__pennyBot = undefined;
  await bot?.stop().catch(() => undefined);
  globalThis._db?.close();
  globalThis._db = undefined;

  const dir = dataDir();
  const dbFiles = ["penny.db", "penny.db-wal", "penny.db-shm"];
  const files = [...dbFiles, ".app-lock.json.tmp"].map((f) => path.join(dir, f));
  for (const f of [...files, keyPath(), legacyKeyPath(), lockFilePath()]) shred(f);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir))
      if (f.endsWith(".log")) fs.rmSync(path.join(dir, f), { force: true });
  }
  fs.rmSync(path.join(dir, "logs"), { recursive: true, force: true });
  setKeyInMemory(undefined);
  endAllSessions();

  // Re-reads settings from the fresh database, where auto-sync is off.
  const { reschedule } = await import("@/server/sync/scheduler");
  reschedule();
  return withSession(NextResponse.json({ ok: true }), request, null);
}
