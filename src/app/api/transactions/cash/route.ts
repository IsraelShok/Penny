import { NextResponse } from "next/server";
import { deleteCashExpense, getWalletRows, insertCashExpense } from "@/server/db/queries/transactions";
import { getAppSettings } from "@/server/db/queries/settings";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { isValidOwner, walletBalance, WALLET_DAYS } from "@/lib/tags";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

/** Cash wallet over the last WALLET_DAYS days. */
export async function GET(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const from = new Date(Date.now() - WALLET_DAYS * 86_400_000).toISOString().slice(0, 10);
  return NextResponse.json({ days: WALLET_DAYS, ...walletBalance(getWalletRows(workspaceId, from)) });
}

/** Logs cash spending: { amount > 0, description?, owner? }. */
export async function POST(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const body = ((await request.json().catch(() => null)) ?? {}) as { amount?: unknown; description?: unknown; owner?: unknown };
  const amount = body.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 1e7) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 80) : "";
  let owner: string | null = null;
  if (body.owner != null) {
    if (!isValidOwner(body.owner, getAppSettings(workspaceId).household.members.map((m) => m.id))) {
      return NextResponse.json({ error: "invalid owner" }, { status: 400 });
    }
    owner = body.owner;
  }
  const id = insertCashExpense(workspaceId, Math.round(amount * 100) / 100, description || "מזומן", today(), owner);
  return NextResponse.json({ id });
}

/** Undo for a logged cash expense: ?id=. Only removes rows created here (provider 'cash'). */
export async function DELETE(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const id = Number(new URL(request.url).searchParams.get("id"));
  return deleteCashExpense(workspaceId, id)
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: "not found" }, { status: 404 });
}
