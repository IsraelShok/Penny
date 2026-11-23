import { handle, readJson } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { parseAssetInput } from "@/lib/asset-input";
import { deleteAsset, updateAsset } from "@/server/db/queries/assets";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";

export const PUT = handle(
  "assets/[id]",
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const workspaceId = getWorkspaceIdFromRequest(request);
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
    let body: unknown;
    try {
      body = await readJson(request);
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    const parsed = parseAssetInput(body);
    if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });
    if (!updateAsset(workspaceId, id, parsed))
      return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  },
);

export const DELETE = handle(
  "assets/[id]",
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const workspaceId = getWorkspaceIdFromRequest(request);
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
    if (!deleteAsset(workspaceId, id))
      return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  },
);
