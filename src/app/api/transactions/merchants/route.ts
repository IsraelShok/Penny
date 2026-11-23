import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { getMerchantRows } from "@/server/db/queries/transactions";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";

/** Every merchant with how often and how much, for Settings > Payees. */
export const GET = handle("transactions/merchants", async (request: Request) => {
  return NextResponse.json({ merchants: getMerchantRows(getWorkspaceIdFromRequest(request)) });
});
