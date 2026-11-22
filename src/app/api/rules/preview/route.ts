import { NextResponse } from "next/server";
import { previewRule, validateRule } from "@/server/db/queries/rules";
import { parseRuleBody } from "@/server/rules/parse";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";

export const dynamic = "force-dynamic";

/** POST {rule} → how many existing transactions the rule would change, plus up to 5 descriptions. */
export async function POST(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as {
    rule?: Record<string, unknown>;
  } | null;
  const rule = parseRuleBody(body?.rule ?? null);
  if (!rule) return NextResponse.json({ error: "Invalid rule" }, { status: 400 });
  try {
    validateRule(workspaceId, rule);
    return NextResponse.json(previewRule(workspaceId, rule));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid rule" },
      { status: 400 },
    );
  }
}
