import { NextResponse } from "next/server";
import { latestUpdate } from "@/server/update/latest";

export const dynamic = "force-dynamic";

/** { update: null } when up to date, else the newer release and how to install it here. */
export async function GET() {
  return NextResponse.json({ update: await latestUpdate() });
}
