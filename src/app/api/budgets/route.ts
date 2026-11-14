import { NextResponse } from "next/server";
import {
  getAllBudgets,
  setBudget,
  deleteBudget,
} from "@/server/db/queries/budgets";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";

export async function GET(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  return NextResponse.json(getAllBudgets(workspaceId));
}

export async function PUT(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const body = ((await request.json().catch(() => null)) ?? {}) as {
    categoryId: number;
    amount?: number | null;
  };

  if (!Number.isSafeInteger(body.categoryId) || body.categoryId <= 0) {
    return NextResponse.json(
      { error: "categoryId is required" },
      { status: 400 }
    );
  }

  if (body.amount == null) {
    deleteBudget(workspaceId, body.categoryId);
    return NextResponse.json({ success: true });
  }

  if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount < 0) {
    return NextResponse.json(
      { error: "amount must be non-negative" },
      { status: 400 }
    );
  }

  setBudget(workspaceId, body.categoryId, body.amount, false);
  return NextResponse.json({ success: true });
}
