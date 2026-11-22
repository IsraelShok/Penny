import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { createManualRecurring, ManualRecurringError } from "@/server/insights/manual-recurring";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";

type Ctx = { params: Promise<{ id: string }> };
type Manual = ReturnType<typeof createManualRecurring>;

async function run(request: Request, ctx: Ctx, fn: (m: Manual, id: number) => unknown) {
  const m = createManualRecurring(getDb(), getWorkspaceIdFromRequest(request));
  try {
    return NextResponse.json((await fn(m, Number((await ctx.params).id))) ?? { success: true });
  } catch (e) {
    if (e instanceof ManualRecurringError)
      return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

/** Charges that could be attached to this series. */
export function GET(request: Request, ctx: Ctx) {
  return run(request, ctx, (m, id) => ({ candidates: m.candidates(id) }));
}

/** Field overrides, or { attach: txnId } / { detach: txnId } / { restore: true }. */
export function PATCH(request: Request, ctx: Ctx) {
  return run(request, ctx, async (m, id) => {
    const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    if (body.attach !== undefined) return m.setAttached(id, body.attach, true);
    if (body.detach !== undefined) return m.setAttached(id, body.detach, false);
    if (body.restore === true) return m.setDeleted(id, false);
    return m.update(id, body);
  });
}

/** Soft delete; PATCH { restore: true } brings it back. */
export function DELETE(request: Request, ctx: Ctx) {
  return run(request, ctx, (m, id) => m.setDeleted(id, true));
}
