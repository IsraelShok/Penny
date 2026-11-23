import { NextResponse } from "next/server";
import { createBackup, listBackups, MIN_PASSPHRASE } from "@/server/lib/portable-backup";
import { lockReauth } from "@/server/lib/lock-reauth";

/** The encrypted backups already on disk. */
export async function GET() {
  return NextResponse.json({ backups: listBackups() });
}

/**
 * Creates one passphrase-encrypted backup file: { passphrase, secret? }. The response is the file itself,
 * so the browser downloads it and no copy is left in a temp folder. The file holds the key to every
 * saved login under a passphrase the caller picks, so with the app lock on the lock passphrase (secret)
 * is asked again: a borrowed session must not be enough to take it.
 */
export async function POST(request: Request) {
  const body = ((await request.json().catch(() => null)) ?? {}) as {
    passphrase?: unknown;
    secret?: unknown;
  };
  const passphrase = typeof body.passphrase === "string" ? body.passphrase : "";
  if (passphrase.length < MIN_PASSPHRASE)
    return NextResponse.json({ error: "weakPassphrase" }, { status: 400 });
  const refused = await lockReauth(body.secret);
  if (refused) return refused;
  try {
    const { bytes, fileName } = createBackup(passphrase);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : "backupFailed";
    return NextResponse.json({ error: code }, { status: 500 });
  }
}
