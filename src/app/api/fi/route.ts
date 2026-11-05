import { NextResponse } from "next/server";
import { getMonthlyAverages, getPersonalInflation } from "@/server/db/queries/fi";
import { getAssetsPayload } from "@/server/markets/portfolio";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import type { FiPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const assets = await getAssetsPayload(workspaceId);
  const payload: FiPayload = {
    ...getMonthlyAverages(workspaceId),
    netWorth: assets.totals.netWorth,
    liquidNetWorth: assets.totals.liquidNetWorth,
    hasAssets: assets.assets.length > 0,
    inflation: getPersonalInflation(workspaceId),
  };
  return NextResponse.json(payload);
}
