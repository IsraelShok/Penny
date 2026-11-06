import { NextResponse } from "next/server";
import { checkSecret, unlock } from "@/server/lib/app-lock";
import { withSession } from "../session-cookie";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { secret } = (await request.json().catch(() => ({}))) as { secret?: unknown };
  const check = await checkSecret(secret);
  if (!check.ok) return NextResponse.json({ error: check.reason, retryAfter: check.retryAfter }, { status: check.reason === "wait" ? 429 : 401 });
  const token = await unlock(secret as string);
  // The bot could not read its token while the key was wrapped.
  const { startBot } = await import("@/server/bot");
  startBot();
  return withSession(NextResponse.json({ ok: true }), request, token);
}
