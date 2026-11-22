import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { createManualRecurring, ManualRecurringError } from "@/server/insights/manual-recurring";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";

export async function GET(request: Request) {
  return NextResponse.json({
    items: createManualRecurring(getDb(), getWorkspaceIdFromRequest(request)).list(),
  });
}

export async function POST(request: Request) {
  const m = createManualRecurring(getDb(), getWorkspaceIdFromRequest(request));
  const body = (await request.json().catch(() => null)) ?? {};
  try {
    return NextResponse.json({ id: m.create(body) });
  } catch (e) {
    if (e instanceof ManualRecurringError)
      return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
