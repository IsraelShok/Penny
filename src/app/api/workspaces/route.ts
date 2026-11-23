import { NextResponse } from "next/server";
import { createWorkspace, listWorkspaces } from "@/server/db/queries/workspaces";
import { accessEnabled, currentUser, membership } from "@/server/lib/user-access";
import { parseAvatar } from "@/lib/profile-avatar";

import { errorResponse, handle, readJson } from "@/server/lib/api-error";

export const GET = handle("workspaces", async (request: Request) => {
  const user = currentUser(request);
  return NextResponse.json(
    listWorkspaces().filter((ws) => !accessEnabled() || (!!user && !!membership(user, ws.id))),
  );
});

export const POST = handle("workspaces", async (request: Request) => {
  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const name =
    typeof (body as { name?: unknown })?.name === "string" ? (body as { name: string }).name : "";

  if (!name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const avatar = parseAvatar(body);
  if ("error" in avatar) {
    return NextResponse.json({ error: avatar.error }, { status: 400 });
  }

  try {
    const ws = createWorkspace(name, avatar);
    return NextResponse.json(ws, { status: 201 });
  } catch (err) {
    return errorResponse("workspaces", err);
  }
});
