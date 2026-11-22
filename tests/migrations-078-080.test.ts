import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runMigrations } from "@/server/db/migrate";

const NEW = ["078_import_file_name.sql", "079_device_tokens.sql", "080_reconcile.sql"];

describe("migrations 078–080 on an existing install", () => {
  it("apply on top of a database at 077 without touching its data", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-mig-078-"));
    process.env.PENNY_DATA_DIR = dir;
    const db = new Database(path.join(dir, "penny.db"));
    runMigrations(db);
    // Roll the schema back to where 077 left it.
    db.exec(`
      DROP TABLE manual_recurring_txns; DROP TABLE manual_recurring; DROP TABLE generic_descriptions;
      DROP TABLE reconcile_undo; DROP TABLE reconcile_dismissed; DROP TABLE device_tokens;
      ALTER TABLE sync_runs DROP COLUMN file_name;
    `);
    db.prepare(`DELETE FROM _migrations WHERE name IN (${NEW.map(() => "?").join(",")})`).run(
      ...NEW,
    );

    const ws = (db.prepare("SELECT id FROM workspaces LIMIT 1").get() as { id: number }).id;
    const run = Number(
      db
        .prepare(
          "INSERT INTO sync_runs (workspace_id,provider,status,scrape_from_date,started_at) VALUES (?,'file','completed','2026-01-01','2026-01-01')",
        )
        .run(ws).lastInsertRowid,
    );
    db.prepare(
      "INSERT INTO transactions (workspace_id,account_number,date,processed_date,original_amount,original_currency,charged_amount,description,type,status,provider,sync_run_id,dedup_hash,kind) VALUES (?,'1','2026-01-02','2026-01-02',-10,'ILS',-10,'קפה','normal','completed','file',?,'h1','expense')",
    ).run(ws, run);
    const snapshot = () => ({
      runs: db.prepare("SELECT id, provider, status FROM sync_runs ORDER BY id").all(),
      txns: db
        .prepare("SELECT id, description, charged_amount FROM transactions ORDER BY id")
        .all(),
    });
    const before = snapshot();

    runMigrations(db);
    expect(snapshot()).toEqual(before);
    const applied = db.prepare("SELECT name FROM _migrations").all() as { name: string }[];
    expect(applied.map((a) => a.name)).toEqual(expect.arrayContaining(NEW));
    expect(
      (db.prepare("SELECT file_name FROM sync_runs WHERE id=?").get(run) as { file_name: null })
        .file_name,
    ).toBeNull();
    for (const t of ["device_tokens", "reconcile_undo", "reconcile_dismissed", "manual_recurring"])
      expect(db.prepare("SELECT COUNT(*) AS n FROM " + t).get()).toEqual({ n: 0 });
    // Running again is a no-op.
    runMigrations(db);
    expect(snapshot()).toEqual(before);
    db.close();
  });
});
