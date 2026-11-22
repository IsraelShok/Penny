import { NextResponse } from "next/server";
import { parseProgress } from "@/lib/life-stages";
import { getWorkspaceSetting, setWorkspaceSetting } from "@/server/db/queries/settings";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";

export const dynamic = "force-dynamic";
const KEY = "life_checklists";

function read(ws: number) {
  try {
    return parseProgress(JSON.parse(getWorkspaceSetting(ws, KEY) ?? "{}"));
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  return NextResponse.json(read(getWorkspaceIdFromRequest(request)));
}

/** Body: { progress: { stageId: itemId[] } } — replaces checklist progress. */
export async function PUT(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  const body = await request.json().catch(() => null);
  if (!body?.progress) return NextResponse.json({ error: "progress is required" }, { status: 400 });
  const progress = parseProgress(body.progress);
  setWorkspaceSetting(ws, KEY, JSON.stringify(progress));
  return NextResponse.json(progress);
}
