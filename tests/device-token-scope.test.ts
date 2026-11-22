import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

beforeAll(() => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-device-scope-"));
  vi.resetModules();
  globalThis.__pennyDataKey = undefined;
});

const quickAdd = (auth: string, headers: Record<string, string> = {}) =>
  new Request("http://127.0.0.1/api/quick-add", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: auth, ...headers },
    body: JSON.stringify({ amount: 25, description: "מאפייה" }),
  });

describe("device tokens across workspaces", () => {
  it("writes only into the token's own workspace, whatever header is sent", async () => {
    const { getDb } = await import("@/server/db");
    const tokens = await import("@/server/lib/device-tokens");
    const route = await import("@/app/api/quick-add/route");
    const db = getDb();
    const main = (db.prepare("SELECT id FROM workspaces LIMIT 1").get() as { id: number }).id;
    const other = Number(
      db.prepare("INSERT INTO workspaces (name, slug) VALUES ('Other', 'other')").run()
        .lastInsertRowid,
    );
    const { id, token } = tokens.createDeviceToken(db, other, "Phone");

    // The route never reads x-workspace-id: the token alone picks the workspace.
    const res = await route.POST(quickAdd(`Bearer ${token}`, { "x-workspace-id": String(main) }));
    expect(res.status).toBe(200);
    const txId = ((await res.json()) as { id: number }).id;
    expect(
      (
        db.prepare("SELECT workspace_id FROM transactions WHERE id=?").get(txId) as {
          workspace_id: number;
        }
      ).workspace_id,
    ).toBe(other);

    // The main workspace can neither see nor revoke it.
    expect(tokens.listDeviceTokens(db, main)).toEqual([]);
    expect(tokens.revokeDeviceToken(db, main, id)).toBe(false);
    expect(tokens.listDeviceTokens(db, other)[0].lastUsedAt).not.toBeNull();

    expect(tokens.revokeDeviceToken(db, other, id)).toBe(true);
    expect((await route.POST(quickAdd(`Bearer ${token}`))).status).toBe(401);
  });

  it("refuses malformed headers and an oversized token", async () => {
    const { getDb } = await import("@/server/db");
    const tokens = await import("@/server/lib/device-tokens");
    const db = getDb();
    const ws = (db.prepare("SELECT id FROM workspaces LIMIT 1").get() as { id: number }).id;
    expect(() => tokens.createDeviceToken(db, ws, "  ")).toThrow();
    const { token } = tokens.createDeviceToken(db, ws, "Tablet");
    expect(tokens.verifyDeviceToken(db, `bearer ${token}`)).toMatchObject({ workspaceId: ws });
    for (const bad of [
      null,
      token,
      `Bearer ${token} extra`,
      `Basic ${token}`,
      `Bearer ${token.slice(4)}`,
      `Bearer ${token}${"a".repeat(100)}`,
    ])
      expect(tokens.verifyDeviceToken(db, bad)).toBeNull();
  });

  it("blocks a same-site page from posting with a token", async () => {
    const { proxy } = await import("@/proxy");
    const res = proxy(
      new NextRequest("http://127.0.0.1:3000/api/quick-add", {
        method: "POST",
        headers: {
          host: "127.0.0.1:3000",
          authorization: "Bearer x",
          "sec-fetch-site": "same-site",
        },
      }),
    );
    expect(res.status).toBe(401);
  });
});
