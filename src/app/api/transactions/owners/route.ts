import { NextResponse } from "next/server";
import { getAccountNumbers, getOwnerRows } from "@/server/db/queries/transactions";
import { getAppSettings, getWorkspaceSetting, setWorkspaceSetting } from "@/server/db/queries/settings";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { isValidOwner, ownerSummary, type AccountOwners } from "@/lib/tags";

const KEY = "account_owners";

function readAccountOwners(workspaceId: number, memberIds: string[]): AccountOwners {
  try {
    const raw = JSON.parse(getWorkspaceSetting(workspaceId, KEY) ?? "{}") as Record<string, unknown>;
    // Drop owners of members who were removed from the household.
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => isValidOwner(v, memberIds))) as AccountOwners;
  } catch {
    return {};
  }
}

const memberIdsOf = (workspaceId: number) => getAppSettings(workspaceId).household.members.map((m) => m.id);

/** Owner summary for ?from&to, the default owner per account, and the accounts to pick from. */
export async function GET(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const q = new URL(request.url).searchParams;
  const memberIds = memberIdsOf(workspaceId);
  const accountOwners = readAccountOwners(workspaceId, memberIds);
  const rows = getOwnerRows(workspaceId, q.get("from") ?? "0000", q.get("to") ?? "9999");
  return NextResponse.json({
    accountOwners,
    accounts: getAccountNumbers(workspaceId),
    summary: ownerSummary(rows, accountOwners, memberIds),
  });
}

/** Sets (or clears, with owner null) the default owner of one account: { accountNumber, owner }. */
export async function PUT(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const body = (await request.json().catch(() => ({}))) as { accountNumber?: unknown; owner?: unknown };
  const memberIds = memberIdsOf(workspaceId);
  if (typeof body.accountNumber !== "string" || body.accountNumber.length === 0 || body.accountNumber.length > 64) {
    return NextResponse.json({ error: "accountNumber is required" }, { status: 400 });
  }
  if (body.owner !== null && !isValidOwner(body.owner, memberIds)) {
    return NextResponse.json({ error: "owner must be a household member, shared, or null" }, { status: 400 });
  }
  const next = { ...readAccountOwners(workspaceId, memberIds) };
  if (body.owner === null) delete next[body.accountNumber];
  else next[body.accountNumber] = body.owner;
  setWorkspaceSetting(workspaceId, KEY, JSON.stringify(next));
  return NextResponse.json({ accountOwners: next });
}
