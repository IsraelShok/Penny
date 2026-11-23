import { handle } from "@/server/lib/api-error";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { endAllSessions, shred } from "@/server/lib/app-lock";
import { lockReauth } from "@/server/lib/lock-reauth";
import { keyPath, legacyKeyPath, lockFilePath, setKeyInMemory } from "@/server/lib/encryption";
import { dataDir } from "@/server/lib/data-dir";
import { LAN_FLAG } from "@/server/lib/lan-access";
import { withSession } from "../../lock/session-cookie";

export const dynamic = "force-dynamic";

// The typed confirmation word, in either UI language.
const WIPE_WORDS = ["מחיקה", "delete"];

// Plain copies of the data that live beside the database: pre-migration and pre-restore snapshots,
// insurance documents, receipts, and statements waiting in the import folder.
const WIPED_DIRS = ["backups", "policies", "receipts", "import", "logs"];

/**
 * Deletes everything: the database (credentials, settings, AI keys, Telegram), the key or wrapped key,
 * every copy and document in the data folder, and logs. Back to first run. Backup files the user
 * saved elsewhere are theirs to delete.
 */
export const POST = handle("data/wipe", async (request: Request) => {
  const body = (await request.json().catch(() => null)) as {
    confirm?: unknown;
    secret?: unknown;
  } | null;
  const confirm = body?.confirm;
  const secret = body?.secret;
  if (typeof confirm !== "string" || !WIPE_WORDS.includes(confirm.trim().toLowerCase()))
    return NextResponse.json({ error: "confirm" }, { status: 400 });
  const refused = await lockReauth(secret);
  if (refused) return refused;

  // Stop background work that holds the bot token or would write to the database mid-wipe.
  const bot = globalThis.__pennyBot;
  globalThis.__pennyBot = undefined;
  // A bot that fails to stop cleanly is dropped anyway: the wipe must go on.
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
  for (const d of WIPED_DIRS) fs.rmSync(path.join(dir, d), { recursive: true, force: true });
  // Left by older migrations next to the database: full copies and a report naming accounts.
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir))
      if (
        f.endsWith(".bak") ||
        f === "profiles-migration-report.json" ||
        f === LAN_FLAG ||
        f === "mcp-token"
      )
        fs.rmSync(path.join(dir, f), { force: true });
  }
  // The desktop shell keeps the server output one folder up and holds it open, so it is emptied, not removed.
  if (process.env.PENNY_INSTALL === "desktop") {
    try {
      fs.truncateSync(path.join(dir, "..", "server.log"));
    } catch {
      // The OS can refuse while the file is open; nothing more to do from here.
    }
  }
  setKeyInMemory(undefined);
  endAllSessions();

  // Re-reads settings from the fresh database, where auto-sync is off.
  const { reschedule } = await import("@/server/sync/scheduler");
  reschedule();
  return withSession(NextResponse.json({ ok: true }), request, null);
});
