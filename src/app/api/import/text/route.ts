import { israelToday } from "@/server/lib/date-utils";
import { NextResponse } from "next/server";
import { completeAI } from "@/server/ai/ask";
import { EXTRACT_SYSTEM, MAX_TEXT_IMPORT, parseExtractedRows } from "@/lib/text-import";

export const dynamic = "force-dynamic";

/**
 * Import from any text: the pasted text goes to the user's own AI provider, and the rows come back for
 * the sheet import's preview. Nothing is saved here; the user checks the rows and imports them there.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (text.length > MAX_TEXT_IMPORT)
    return NextResponse.json({ error: "tooLong" }, { status: 413 });
  const today = israelToday();
  let reply: string | null;
  try {
    reply = await completeAI(EXTRACT_SYSTEM, `Today is ${today}.\n\nText:\n${text}`, 4000);
  } catch {
    return NextResponse.json({ error: "aiFailed" }, { status: 502 });
  }
  if (reply == null) return NextResponse.json({ error: "noProvider" }, { status: 503 });
  return NextResponse.json({ rows: parseExtractedRows(reply) });
}
