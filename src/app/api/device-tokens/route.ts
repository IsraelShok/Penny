import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { createDeviceToken, listDeviceTokens, revokeDeviceToken } from "@/server/lib/device-tokens";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return NextResponse.json({
    tokens: listDeviceTokens(getDb(), getWorkspaceIdFromRequest(request)),
  });
}

/** Creates a token; the response is the only time the token itself is shown. */
export async function POST(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  if (typeof body?.name !== "string" || !body.name.trim())
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  return NextResponse.json(createDeviceToken(getDb(), ws, body.name));
}

export async function DELETE(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0)
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  return NextResponse.json({ revoked: revokeDeviceToken(getDb(), ws, id) });
}
