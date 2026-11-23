import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { listExcludedMerchants } from "@/server/db/queries/excluded-merchants";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";

export const GET = handle("excluded-merchants", async (request: Request) => {
  const workspaceId = getWorkspaceIdFromRequest(request);
  return NextResponse.json({ rules: listExcludedMerchants(workspaceId) });
});
