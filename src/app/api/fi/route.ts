import { NextResponse } from "next/server";
import { getMonthlyAverages, getPersonalInflation } from "@/server/db/queries/fi";
import { getAssetsPayload } from "@/server/markets/portfolio";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import type { AssetType, FiPayload } from "@/lib/types";

/** Holdings whose losses offset capital gains. */
const TAXABLE: AssetType[] = ["stock", "fund", "bond", "crypto", "metal", "other"];

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const assets = await getAssetsPayload(workspaceId);
  const payload: FiPayload = {
    ...getMonthlyAverages(workspaceId),
    netWorth: assets.totals.netWorth,
    liquidNetWorth: assets.totals.liquidNetWorth,
    hasAssets: assets.assets.length > 0,
    cashReserve: assets.assets
      .filter((a) => a.type === "cash" || a.type === "deposit")
      .reduce((s, a) => s + (a.valueIls ?? 0), 0),
    taxableLosses: assets.assets
      .filter((a) => !a.isLiability && TAXABLE.includes(a.type) && (a.gainIls ?? 0) < 0)
      .reduce((s, a) => s - a.gainIls!, 0),
    deferredTax: assets.totals.deferredTax,
    inflation: getPersonalInflation(workspaceId),
  };
  return NextResponse.json(payload);
}
