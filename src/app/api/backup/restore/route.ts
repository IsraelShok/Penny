import { logError } from "@/server/lib/log";
import { handle, domainMessage } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { applyBackup, MIN_PASSPHRASE } from "@/server/lib/portable-backup";
import { lockReauth } from "@/server/lib/lock-reauth";

/**
 * Restores a backup: multipart { file, passphrase, secret? } (secret: the lock passphrase, when the lock is on). The passphrase must open the file, and the
 * contents must be a Penny database, before anything is replaced. The current database is copied
 * to data/backups first, so this is undoable.
 */
export const POST = handle("backup/restore", async (request: Request) => {
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "badForm" }, { status: 400 });
  const file = form.get("file");
  const passphrase =
    typeof form.get("passphrase") === "string" ? String(form.get("passphrase")) : "";
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: "fileRequired" }, { status: 400 });
  if (passphrase.length < MIN_PASSPHRASE)
    return NextResponse.json({ error: "weakPassphrase" }, { status: 400 });
  const refused = await lockReauth(form.get("secret"));
  if (refused) return refused;
  try {
    const result = applyBackup(Buffer.from(await file.arrayBuffer()), passphrase);
    return NextResponse.json(result);
  } catch (e) {
    const code = domainMessage(e) ?? "restoreFailed";
    if (code === "restoreFailed") logError("backup/restore", e);
    const status = code === "badPassphrase" ? 401 : code === "corruptRestore" ? 422 : 400;
    return NextResponse.json({ error: code }, { status });
  }
});
