import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { latestUpdate, setUpdateCheckSetting, updateCheckSetting } from "@/server/update/latest";

export const dynamic = "force-dynamic";

/** { update: null } when up to date, else the newer release and how to install it here. */
export const GET = handle("update", async () => {
  return NextResponse.json({ update: await latestUpdate(), enabled: updateCheckSetting() });
});

/** { enabled: boolean }: the Settings > Privacy switch for asking GitHub about new versions. */
export const PATCH = handle("update", async (request: Request) => {
  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean")
    return NextResponse.json({ error: "enabled must be true or false" }, { status: 400 });
  setUpdateCheckSetting(body.enabled);
  return NextResponse.json({ enabled: body.enabled });
});
