import { NextResponse } from "next/server";
import { parseAssetInput } from "@/lib/asset-input";
import { createAssets } from "@/server/db/queries/assets";
import { getAssetsPayload } from "@/server/markets/portfolio";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import type { AssetInput } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_IMPORT = 500;

export async function GET(request: Request) {
  return NextResponse.json(await getAssetsPayload(getWorkspaceIdFromRequest(request)));
}

/** Body: { assets: [...] } — one asset from the form, or many from a CSV import. All or nothing. */
export async function POST(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const list = (body as { assets?: unknown })?.assets;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_IMPORT) {
    return NextResponse.json({ error: `assets must be a list of 1-${MAX_IMPORT}` }, { status: 400 });
  }
  const parsed: AssetInput[] = [];
  for (const [i, raw] of list.entries()) {
    const p = parseAssetInput(raw);
    if (typeof p === "string") return NextResponse.json({ error: p, row: i + 1 }, { status: 400 });
    parsed.push(p);
  }
  return NextResponse.json({ created: createAssets(workspaceId, parsed) });
}
