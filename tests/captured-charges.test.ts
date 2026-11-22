import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import {
  createCapturedCharge,
  matchCapturedCharges,
} from "@/server/db/queries/manual-transactions";

function fixture() {
  const db = new Database(":memory:");
  for (const file of readdirSync("src/server/db/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(readFileSync(`src/server/db/migrations/${file}`, "utf8"));
  const ws = (db.prepare("SELECT id FROM workspaces LIMIT 1").get() as { id: number }).id;
  const run = Number(
    db
      .prepare(
        "INSERT INTO sync_runs (workspace_id,provider,status,scrape_from_date,started_at) VALUES (?,'max','completed','2026-01-01','2026-11-01')",
      )
      .run(ws).lastInsertRowid,
  );
  let n = 0;
  const bank = (account: string, date: string, amount: number) =>
    Number(
      db
        .prepare(
          "INSERT INTO transactions (workspace_id,account_number,date,processed_date,original_amount,original_currency,charged_amount,description,type,status,provider,sync_run_id,dedup_hash,kind) VALUES (?,?,?,?,?,'ILS',?,'SHUFERSAL','normal','completed','max',?,?,'expense')",
        )
        .run(ws, account, date, date, -amount, -amount, run, `b${++n}`).lastInsertRowid,
    );
  const row = (id: number) =>
    db.prepare("SELECT * FROM transactions WHERE id=?").get(id) as
      Record<string, unknown> | undefined;
  return { db, ws, bank, row };
}

describe("captured charges", () => {
  it("lands on the named card as a pending manual expense", () => {
    const { db, ws, bank, row } = fixture();
    bank("1234", "2026-10-01", 10);
    const id = createCapturedCharge(db, ws, {
      amount: 123.45,
      description: "שופרסל",
      date: "2026-11-20",
      last4: "1234",
    });
    expect(row(id)).toMatchObject({
      account_number: "1234",
      provider: "manual",
      status: "pending",
      charged_amount: -123.45,
    });
    expect(String(row(id)?.dedup_hash)).toMatch(/^sms:/);
  });

  it("folds into its bank twin once, keeping the captured category", () => {
    const { db, ws, bank, row } = fixture();
    bank("1234", "2026-10-01", 10);
    const cat = (
      db
        .prepare("SELECT id FROM categories WHERE workspace_id=? AND kind='expense' LIMIT 1")
        .get(ws) as { id: number }
    ).id;
    const a = createCapturedCharge(db, ws, {
      amount: 50,
      description: "x",
      date: "2026-11-20",
      last4: "1234",
    });
    const b = createCapturedCharge(db, ws, {
      amount: 50,
      description: "y",
      date: "2026-11-20",
      last4: "1234",
    });
    db.prepare("UPDATE transactions SET category_id=?, category_source='user' WHERE id=?").run(
      cat,
      a,
    );
    expect(matchCapturedCharges(db, ws)).toBe(0); // no bank row yet
    const other = bank("9999", "2026-11-21", 50); // other card: not a twin
    const twin = bank("1234", "2026-11-22", 50);
    expect(matchCapturedCharges(db, ws)).toBe(1);
    expect(row(a)).toBeUndefined();
    expect(row(b)).toBeDefined(); // a second identical charge waits for its own bank row
    expect(row(twin)?.category_id).toBe(cat);
    expect(row(other)?.category_id).toBeNull();
  });

  it("ignores bank rows outside the date window or with another amount", () => {
    const { db, ws, bank } = fixture();
    createCapturedCharge(db, ws, { amount: 20, description: "x", date: "2026-11-01" });
    bank("5555", "2026-11-15", 20);
    bank("5555", "2026-11-02", 21);
    expect(matchCapturedCharges(db, ws)).toBe(0);
    bank("5555", "2026-11-03", 20); // card unknown: any account matches
    expect(matchCapturedCharges(db, ws)).toBe(1);
  });
});
