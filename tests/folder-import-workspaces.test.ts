import { beforeAll, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let getDb: typeof import("@/server/db/index").getDb;
let lib: typeof import("@/server/lib/folder-import");

beforeAll(async () => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-folder-ws-"));
  getDb = (await import("@/server/db/index")).getDb;
  lib = await import("@/server/lib/folder-import");
});

it("matches a workspace by name or workspace-<id>, and leaves account folders alone", () => {
  const ws = [
    { id: 1, name: "Default" },
    { id: 2, name: "Family" },
  ];
  expect(lib.workspaceForFolder("family", ws)).toBe(2);
  expect(lib.workspaceForFolder("Workspace-2", ws)).toBe(2);
  expect(lib.workspaceForFolder("workspace-99", ws)).toBeNull();
  expect(lib.workspaceForFolder("max (1234)", ws)).toBeUndefined();
});

it("imports each workspace subfolder into its own workspace", async () => {
  const db = getDb();
  const first = (
    db.prepare("SELECT id FROM workspaces ORDER BY id LIMIT 1").get() as { id: number }
  ).id;
  const family = Number(
    db.prepare("INSERT INTO workspaces (name, slug) VALUES ('Family', 'family')").run()
      .lastInsertRowid,
  );
  const dir = lib.defaultImportDir();
  const csv = (what: string, amount: number) =>
    `תאריך,תיאור,חובה,זכות\n01/02/2024,${what},${amount},\n`;
  const put = (rel: string, body: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  };
  put("root.csv", csv("root", 11));
  put("FAMILY/loose.csv", csv("loose", 22));
  put("family/card (777)/card.csv", csv("card", 33));
  put(`workspace-${family}/byid.csv`, csv("byid", 44));
  put("workspace-999/lost.csv", csv("lost", 55));
  put("pension fund/acct.csv", csv("acct", 66));

  const config = await lib.scanImportFolder(true);
  expect(config.status).toBe("ok");

  const stored = db
    .prepare(
      "SELECT workspace_id AS ws, description, account_number AS account FROM transactions ORDER BY description",
    )
    .all() as { ws: number; description: string; account: string }[];
  expect(stored.map((r) => [r.description, r.ws])).toEqual([
    ["acct", first], // a plain subfolder is still an account of the default workspace
    ["byid", family],
    ["card", family],
    ["loose", family],
    ["root", first],
  ]);
  expect(stored.find((r) => r.description === "card")?.account).toBe("777");
  expect(stored.find((r) => r.description === "acct")?.account).toBe("pension fund");

  // The unknown workspace folder is neither imported nor moved, and is reported once.
  expect(fs.existsSync(path.join(dir, "workspace-999", "lost.csv"))).toBe(true);
  const again = await lib.scanImportFolder(true);
  expect(again.history.filter((h) => h.error === "unknownWorkspace")).toEqual([
    expect.objectContaining({ file: "workspace-999/", added: 0 }),
  ]);
});
