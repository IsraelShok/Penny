import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { editTransactions, EditError } from "@/server/db/queries/transaction-edits";
export async function POST(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Invalid edit" }, { status: 400 });
  try {
    return NextResponse.json(editTransactions(getDb(), ws, body));
  } catch (error) {
    if (error instanceof EditError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
