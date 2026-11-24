import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { isLockEnabled } from "@/server/lib/app-lock";
import { isLanEnabled, lanAddresses, setLanEnabled } from "@/server/lib/lan-access";

export const dynamic = "force-dynamic";

// Set by scripts/serve.mjs and desktop/main.cjs: the host the server was started on, and whether exit code 75 restarts it.
const listening = () => process.env.PENNY_LISTEN_HOST ?? null;
const restartable = () => process.env.PENNY_RESTARTABLE === "1";

export const GET = handle("lan", async (request: Request) => {
  const enabled = isLanEnabled();
  const host = listening();
  const port = new URL(request.url).port || process.env.PORT || "";
  return NextResponse.json({
    enabled,
    lockEnabled: isLockEnabled(),
    // null when the launcher is unknown (dev, manual `next start`): the UI shows instructions instead.
    needsRestart: host === null ? null : enabled !== (host === "0.0.0.0"),
    restartable: restartable(),
    urls: lanAddresses().map((ip) => `http://${ip}:${port}`),
    platform: process.platform,
  });
});

export const POST = handle("lan", async (request: Request) => {
  const body = ((await request.json().catch(() => ({}))) ?? {}) as {
    enabled?: unknown;
    action?: unknown;
  };
  if (body.action === "restart") {
    if (!restartable()) return NextResponse.json({ error: "not_restartable" }, { status: 400 });
    setTimeout(() => process.exit(75), 300); // the launcher re-reads the flag and starts again
    return NextResponse.json({ ok: true });
  }
  if (typeof body.enabled !== "boolean")
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (body.enabled && !isLockEnabled())
    return NextResponse.json({ error: "lock_required" }, { status: 409 });
  setLanEnabled(body.enabled);
  return NextResponse.json({ ok: true });
});
