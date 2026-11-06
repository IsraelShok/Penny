import { NextResponse } from "next/server";
import { getChildRows } from "@/server/db/queries/transactions";
import { getAppSettings, getWorkspaceSetting } from "@/server/db/queries/settings";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { effectiveOwner, type AccountOwners } from "@/lib/tags";
import { childSummary } from "@/lib/kids";

/** One child's summary for ?member&month=YYYY-MM, plus that month's transactions. */
export async function GET(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const q = new URL(request.url).searchParams;
  const member = q.get("member");
  const month = q.get("month") ?? "";
  const child = getAppSettings(workspaceId).household.members.find((m) => m.id === member && m.role === "child");
  if (!child || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "child member and month required" }, { status: 400 });
  let accountOwners: AccountOwners = {};
  try { accountOwners = JSON.parse(getWorkspaceSetting(workspaceId, "account_owners") ?? "{}"); } catch { /* none */ }
  const year = month.slice(0, 4);
  const rows = getChildRows(workspaceId, `${year}-01-01`, `${year}-12-31`)
    .filter((r) => effectiveOwner(r.owner, r.accountNumber, accountOwners) === child.id);
  return NextResponse.json({
    child,
    summary: childSummary(rows, month),
    transactions: rows.filter((r) => r.date.startsWith(month)).map(({ id, date, amount, description, category }) => ({ id, date, amount, description, category })),
  });
}
