import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runMigrations, toIsraelDays } from "@/server/db/migrate";

/** The migration runner's guards: a missing folder, a damaged file, a second process, a failed FK check. */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-migrate-core-"));
let migrated: Buffer;

beforeAll(() => {
  process.env.PENNY_DATA_DIR = dir;
  const db = new Database(":memory:");
  runMigrations(db);
  migrated = db.serialize();
  db.close();
});
afterEach(() => vi.restoreAllMocks());

/** A fully migrated database, fresh for each test. */
const clone = () => new Database(migrated);
const appliedCount = (db: Database.Database) =>
  (db.prepare("SELECT COUNT(*) AS n FROM _migrations").get() as { n: number }).n;

describe("runMigrations", () => {
  it("refuses to run without the migrations folder, instead of creating an empty schema", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    expect(() => runMigrations(new Database(":memory:"))).toThrow(
      /\[db\] migrations folder not found: .*src[\\/]server[\\/]db[\\/]migrations/,
    );
  });

  it("falls back to the source folder under the working directory (a bundled server)", () => {
    const real = fs.existsSync;
    const seen: string[] = [];
    vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      seen.push(String(p));
      // Only the first lookup (next to the compiled file) misses.
      return seen.length === 1 ? false : real(p);
    });
    const db = clone();
    runMigrations(db);
    expect(seen[1]).toBe(path.join(process.cwd(), "src/server/db/migrations"));
    expect(appliedCount(db)).toBeGreaterThan(50);
  });

  it("is a no-op on a database that is already up to date", () => {
    const db = clone();
    const before = appliedCount(db);
    runMigrations(db);
    expect(appliedCount(db)).toBe(before);
  });

  it("refuses a database written by a newer version", () => {
    const db = clone();
    db.prepare("INSERT INTO _migrations (name) VALUES ('999_future.sql')").run();
    expect(() => runMigrations(db)).toThrow(
      "[db] this database was written by a newer version (unknown migration 999_future.sql). Update the app.",
    );
  });

  it("never migrates a damaged database, but still opens one with nothing pending", async () => {
    const log = await import("@/server/lib/log");
    const logged = vi.spyOn(log, "logError").mockImplementation(() => undefined);

    const db = clone();
    const real = db.pragma.bind(db);
    vi.spyOn(db, "pragma").mockImplementation(((src: string, opts?: { simple?: boolean }) =>
      src === "quick_check" ? "row 7 missing from index" : real(src, opts)) as typeof db.pragma);
    // Nothing pending: opens, so the data can be exported or a backup restored, and the damage is logged.
    expect(() => runMigrations(db)).not.toThrow();
    expect(logged).toHaveBeenCalledTimes(1);
    expect(String(logged.mock.calls[0][1])).toMatch(/integrity check failed: row 7 missing/);

    // Something pending: refuses before rewriting anything.
    db.prepare("DELETE FROM _migrations WHERE name = '049_goal_details.sql'").run();
    expect(() => runMigrations(db)).toThrow(
      "[db] integrity check failed: row 7 missing from index. Backups live in the data/backups folder.",
    );
    expect(db.prepare("SELECT 1 FROM _migrations WHERE name = '049_goal_details.sql'").get()).toBe(
      undefined,
    );
  });

  it("a migration that leaves dangling foreign keys fails and foreign keys are back on", () => {
    const db = clone();
    db.prepare("DELETE FROM _migrations WHERE name = '049_goal_details.sql'").run();
    const real = db.pragma.bind(db);
    vi.spyOn(db, "pragma").mockImplementation(((src: string, opts?: { simple?: boolean }) =>
      src === "foreign_key_check"
        ? [{ table: "goals", rowid: 1, parent: "workspaces", fkid: 0 }]
        : real(src, opts)) as typeof db.pragma);
    expect(() => runMigrations(db)).toThrow(
      /Foreign key violations after migration 049_goal_details\.sql: \[\{"table":"goals"/,
    );
    vi.restoreAllMocks();
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("a second process that applied a file meanwhile is not applied twice", () => {
    const db = clone();
    const before = appliedCount(db);
    // This process read an empty list before the other one finished: every file looks pending.
    const prepare = db.prepare.bind(db);
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql === "SELECT name FROM _migrations")
        return prepare("SELECT name FROM _migrations WHERE 0");
      return prepare(sql);
    }) as typeof db.prepare);
    // Re-running an ALTER would throw "duplicate column name"; the in-transaction re-check skips it.
    expect(() => runMigrations(db)).not.toThrow();
    vi.restoreAllMocks();
    expect(appliedCount(db)).toBe(before);
  });

  it("goal details and the profile Pip are added only when missing", () => {
    const db = clone();
    db.prepare("DELETE FROM _migrations WHERE name = '049_goal_details.sql'").run();
    runMigrations(db); // columns already there: no duplicate column error
    const cols = (db.pragma("table_info(goals)") as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["kind", "details"]));

    db.exec("ALTER TABLE goals DROP COLUMN details");
    db.exec("ALTER TABLE profiles DROP COLUMN avatar_pet");
    db.prepare("DELETE FROM _migrations WHERE name = '049_goal_details.sql'").run();
    runMigrations(db);
    expect((db.pragma("table_info(goals)") as { name: string }[]).map((c) => c.name)).toContain(
      "details",
    );
    expect((db.pragma("table_info(profiles)") as { name: string }[]).map((c) => c.name)).toContain(
      "avatar_pet",
    );
  });
});

describe("toIsraelDays", () => {
  it("rewrites instants as the Israeli day and leaves a blank processed date blank", () => {
    const db = clone();
    const ws = (db.prepare("SELECT id FROM workspaces LIMIT 1").get() as { id: number }).id;
    const run = Number(
      db
        .prepare(
          "INSERT INTO sync_runs (workspace_id, provider, status, scrape_from_date, started_at) VALUES (?, 'leumi', 'completed', '2026-01-01', '2026-01-01')",
        )
        .run(ws).lastInsertRowid,
    );
    const insert = db.prepare(
      `INSERT INTO transactions (workspace_id, provider, account_number, date, processed_date, original_amount,
         original_currency, charged_amount, description, status, type, dedup_hash, sync_run_id, kind)
       VALUES (?, 'leumi', '1', ?, ?, -1, 'ILS', -1, 'x', 'completed', 'normal', ?, ${run}, 'expense')`,
    );
    insert.run(ws, "2026-11-30T22:00:00.000Z", "", "h1"); // a blank processed date stays blank
    insert.run(ws, "2026-06-30T21:00:00.000Z", "2026-07-01T21:00:00.000Z", "h2");
    insert.run(ws, "2026-05-05", "2026-05-06", "h3");
    toIsraelDays(db);
    const rows = db
      .prepare(
        "SELECT dedup_hash AS hash, date, processed_date FROM transactions WHERE dedup_hash IN ('h1','h2','h3') ORDER BY dedup_hash",
      )
      .all();
    expect(rows).toEqual([
      { hash: "h1", date: "2026-12-01", processed_date: "" },
      { hash: "h2", date: "2026-07-01", processed_date: "2026-07-02" },
      { hash: "h3", date: "2026-05-05", processed_date: "2026-05-06" },
    ]);
  });
});
