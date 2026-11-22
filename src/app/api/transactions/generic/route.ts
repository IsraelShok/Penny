import { NextResponse } from "next/server";
import {
  addGenericPattern,
  listGenericPatterns,
  removeGenericPattern,
} from "@/server/lib/generic-descriptions";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";

export async function GET(request: Request) {
  return NextResponse.json({ patterns: listGenericPatterns(getWorkspaceIdFromRequest(request)) });
}

/** { pattern } adds a generic description; { pattern, remove: true } removes it. */
export async function POST(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as {
    pattern?: unknown;
    remove?: unknown;
  } | null;
  if (typeof body?.pattern !== "string")
    return NextResponse.json({ error: "pattern is required" }, { status: 400 });
  if (body.remove === true) {
    removeGenericPattern(ws, body.pattern);
    return NextResponse.json({ success: true });
  }
  const pattern = addGenericPattern(ws, body.pattern);
  return pattern
    ? NextResponse.json({ pattern })
    : NextResponse.json({ error: "Invalid pattern" }, { status: 400 });
}
