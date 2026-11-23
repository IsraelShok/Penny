import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { israelToday } from "@/server/lib/date-utils";
import { computeCashAhead } from "@/server/insights/cash-ahead";

export const dynamic = "force-dynamic";

export const GET = handle("cash-ahead", async (request: Request) => {
  return NextResponse.json(computeCashAhead(getWorkspaceIdFromRequest(request), israelToday()));
});
