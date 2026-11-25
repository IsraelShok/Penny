import { NextResponse } from "next/server";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { clearAllSyncLogs, listAllSyncLogs } from "@/server/pension/sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  return NextResponse.json({ logs: listAllSyncLogs(ws) });
}

export async function DELETE(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  clearAllSyncLogs(ws);
  return NextResponse.json({ ok: true });
}
