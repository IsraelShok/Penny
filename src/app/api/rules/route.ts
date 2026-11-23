import { handle, domainMessage } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { applyRuleToPast, createRule, listRules } from "@/server/db/queries/rules";
import { parseRuleBody } from "@/server/rules/parse";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";

export const dynamic = "force-dynamic";

export const GET = handle("rules", async (request: Request) => {
  return NextResponse.json(listRules(getWorkspaceIdFromRequest(request)));
});

export const POST = handle("rules", async (request: Request) => {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const rule = parseRuleBody(body);
  if (!rule || (body?.applyToPast != null && typeof body.applyToPast !== "boolean")) {
    return NextResponse.json({ error: "Invalid rule" }, { status: 400 });
  }
  try {
    const id = createRule(workspaceId, rule);
    const applied = body?.applyToPast === true ? applyRuleToPast(workspaceId, rule) : 0;
    return NextResponse.json({ id, applied }, { status: 201 });
  } catch (err) {
    const error = domainMessage(err);
    if (error == null) throw err;
    return NextResponse.json({ error }, { status: 400 });
  }
});
