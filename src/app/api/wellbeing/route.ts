import { NextResponse } from "next/server";
import { parseWellbeingHistory, wellbeingScore } from "@/lib/wellbeing";
import { getWorkspaceSetting, setWorkspaceSetting } from "@/server/db/queries/settings";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";

export const dynamic = "force-dynamic";
const KEY = "wellbeing_history";

function read(ws: number) {
  try {
    return parseWellbeingHistory(JSON.parse(getWorkspaceSetting(ws, KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  return NextResponse.json(read(getWorkspaceIdFromRequest(request)));
}

/** Body: { answers: number[5] } — scores server-side and adds today's entry (replacing one from the same day). */
export async function POST(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  const body = await request.json().catch(() => null);
  const score = Array.isArray(body?.answers) ? wellbeingScore(body.answers) : null;
  if (score == null)
    return NextResponse.json({ error: "five answers 0–4 are required" }, { status: 400 });
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  const history = parseWellbeingHistory([
    ...read(ws).filter((e) => e.date !== date),
    { date, score },
  ]);
  setWorkspaceSetting(ws, KEY, JSON.stringify(history));
  return NextResponse.json(history);
}
