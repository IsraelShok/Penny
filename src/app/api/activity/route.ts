import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { getActivitySnapshot } from "@/server/sync/activity";

export const dynamic = "force-dynamic";

export const GET = handle("activity", async () => {
  return NextResponse.json(getActivitySnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
});
