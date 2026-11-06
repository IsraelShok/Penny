import { NextResponse } from "next/server";
import { clearBot, getBotConfig, saveBot } from "@/server/bot/config";
import { restartBot } from "@/server/bot";

export const dynamic = "force-dynamic";

/** Never returns the token itself. */
export async function GET() {
  const { token, chatId, username, code } = getBotConfig();
  return NextResponse.json({ connected: !!token, linked: !!chatId, username, code: chatId ? null : code });
}

export async function POST(request: Request) {
  const { token } = (await request.json().catch(() => ({}))) as { token?: unknown };
  if (typeof token !== "string" || !/^\d+:[\w-]{30,}$/.test(token.trim())) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  const res = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`).catch(() => null);
  const me = res?.ok ? ((await res.json()) as { result?: { username?: string } }).result : undefined;
  if (!me?.username) return NextResponse.json({ error: "rejected" }, { status: 400 });
  saveBot(token.trim(), me.username);
  await restartBot();
  return GET();
}

export async function DELETE() {
  clearBot();
  await restartBot();
  return GET();
}
