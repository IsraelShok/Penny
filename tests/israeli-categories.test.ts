import { describe, it, expect, beforeAll } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";

let db: ReturnType<typeof import("@/server/db/index").getDb>;
const sql = fs.readFileSync(
  path.join(process.cwd(), "src/server/db/migrations/045_israeli_categories.sql"),
  "utf-8"
);

beforeAll(async () => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-cats-"));
  db = (await import("@/server/db/index")).getDb();
});

describe("045_israeli_categories", () => {
  it("adds categories to existing workspaces under their group", () => {
    const row = db
      .prepare("SELECT c.need_type, p.name AS parent FROM categories c LEFT JOIN categories p ON p.id = c.parent_id WHERE c.name = 'Arnona'")
      .get() as { need_type: string; parent: string | null };
    expect(row).toMatchObject({ need_type: "need", parent: "Home & Bills" });
  });

  it("re-running never duplicates, and skips names the user made in Hebrew", async () => {
    const { createWorkspace } = await import("@/server/db/queries/workspaces");
    const ws = createWorkspace("cats test").id;
    db.prepare("DELETE FROM categories WHERE workspace_id = ? AND name = 'Electricity'").run(ws);
    db.prepare("INSERT INTO categories (workspace_id, name, color, kind) VALUES (?, 'חשמל', '#000000', 'expense')").run(ws);
    const before = (db.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number }).n;
    db.exec(sql);
    expect((db.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number }).n).toBe(before);
    expect(db.prepare("SELECT 1 FROM categories WHERE workspace_id = ? AND name = 'Electricity'").get(ws)).toBeUndefined();
  });
});
