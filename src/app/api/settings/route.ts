import { handle, domainMessage } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { getAppSettings, updateAppSettings } from "@/server/db/queries/settings";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { profileFromRequest } from "@/server/db/queries/profiles";
import { LOCALE_COOKIE } from "@/i18n/routing";

export const GET = handle("settings", async (request: Request) => {
  const workspaceId = getWorkspaceIdFromRequest(request);
  return NextResponse.json(
    getAppSettings(workspaceId, profileFromRequest(request, workspaceId)?.name),
  );
});

export const PUT = handle("settings", async (request: Request) => {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  try {
    const updated = updateAppSettings(workspaceId, body, profileFromRequest(request, workspaceId));
    if (body.autoSyncEnabled !== undefined || body.autoSyncTime !== undefined) {
      const { reschedule } = await import("@/server/sync/scheduler");
      reschedule();
    }
    const res = NextResponse.json(updated);
    if (body.language === "en" || body.language === "he") {
      res.cookies.set(LOCALE_COOKIE, body.language, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
    return res;
  } catch (err) {
    const message = domainMessage(err);
    if (message == null) throw err;
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
