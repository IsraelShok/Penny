import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { getAppSettings } from "@/server/db/queries/settings";
import { EditError } from "@/server/db/queries/transaction-edits";
import {
  createManualTransaction,
  deleteManualTransaction,
  updateTransactionFields,
} from "@/server/db/queries/manual-transactions";

const memberIds = (ws: number) => getAppSettings(ws).household.members.map((m) => m.id);
const idParam = (request: Request) => {
  const raw = new URL(request.url).searchParams.get("id") ?? "";
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id <= 0)
    throw new EditError("id is required");
  return id;
};
function run(fn: () => unknown) {
  try {
    return NextResponse.json(fn());
  } catch (error) {
    if (error instanceof EditError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

/** Adds a manual expense or income. */
export const POST = handle("transactions/manual", async (request: Request) => {
  const ws = getWorkspaceIdFromRequest(request);
  const body = await request.json().catch(() => null);
  return run(() => ({ id: createManualTransaction(getDb(), ws, body, memberIds(ws)) }));
});

/** Edits ?id=: all fields of a manual row; display fields only for a bank row. */
export const PATCH = handle("transactions/manual", async (request: Request) => {
  const ws = getWorkspaceIdFromRequest(request);
  const body = await request.json().catch(() => null);
  return run(() => {
    updateTransactionFields(getDb(), ws, idParam(request), body, memberIds(ws));
    return { success: true };
  });
});

/** Deletes manual ?id=; returns the row so the client can offer undo (re-POST it). */
export const DELETE = handle("transactions/manual", async (request: Request) => {
  const ws = getWorkspaceIdFromRequest(request);
  return run(() => ({ deleted: deleteManualTransaction(getDb(), ws, idParam(request)) }));
});
