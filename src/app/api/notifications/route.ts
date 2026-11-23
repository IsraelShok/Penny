import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { listNotifications } from "@/server/db/queries/notifications";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";

export const dynamic = "force-dynamic";

export const GET = handle("notifications", (request: Request) => {
  return NextResponse.json({ items: listNotifications(getWorkspaceIdFromRequest(request)) });
});
