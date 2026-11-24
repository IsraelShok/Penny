import { handle, readJson, domainMessage } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import {
  getAutoBackupConfig,
  runAutoBackup,
  updateAutoBackupConfig,
} from "@/server/lib/auto-backup";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { lockReauth } from "@/server/lib/lock-reauth";

export const dynamic = "force-dynamic";
/** A validation key ("notAbsolute") or a malformed body answers 400; disk and database trouble (it carries a code) goes to handle(). */
const fail = (e: unknown) => {
  if (e instanceof Error && "code" in e) throw e;
  return NextResponse.json({ error: domainMessage(e) ?? "invalid" }, { status: 400 });
};

/** Settings and last result; never the passphrase. */
export const GET = handle("backup/auto", async () => {
  return NextResponse.json(getAutoBackupConfig());
});

/** { enabled?, frequency?, dir?, passphrase?, secret? } */
export const PATCH = handle("backup/auto", async (request: Request) => {
  try {
    const body = await readJson(request);
    // A backup holds the raw key, so choosing its passphrase or folder asks for the lock passphrase, like a download.
    if (body?.passphrase !== undefined || body?.dir !== undefined) {
      const refused = await lockReauth(body.secret);
      if (refused) return refused;
    }
    return NextResponse.json(updateAutoBackupConfig(body));
  } catch (e) {
    return fail(e);
  }
});

/** { action: "run" } backs up now; { action: "open" } opens the folder. */
export const POST = handle("backup/auto", async (request: Request) => {
  const body = (await request.json().catch(() => ({}))) as { action?: unknown };
  if (body.action === "run") return NextResponse.json(runAutoBackup());
  if (body.action === "open") {
    const dir = getAutoBackupConfig().dir;
    fs.mkdirSync(dir, { recursive: true });
    const cmd =
      process.platform === "win32"
        ? "explorer"
        : process.platform === "darwin"
          ? "open"
          : "xdg-open";
    spawn(cmd, [dir], { detached: true, stdio: "ignore" })
      .on("error", () => {})
      .unref();
    return NextResponse.json(getAutoBackupConfig());
  }
  return fail(new Error("unknown action"));
});
