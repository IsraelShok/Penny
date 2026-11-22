import { describe, it, expect, afterEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { editTransactions } from "@/server/db/queries/transaction-edits";

const connections: Database.Database[] = [];
function fixture() {
  const db = new Database(":memory:");
  connections.push(db);
  for (const file of readdirSync("src/server/db/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(readFileSync(`src/server/db/migrations/${file}`, "utf8"));
  db.pragma("foreign_keys = ON");
  const ws = (db.prepare("SELECT id FROM workspaces LIMIT 1").get() as { id: number }).id;
  const cats = db
    .prepare(
      "SELECT id FROM categories WHERE workspace_id=? AND kind='expense' AND id NOT IN (SELECT parent_id FROM categories WHERE parent_id IS NOT NULL) LIMIT 2",
    )
    .all(ws) as { id: number }[];
  db.prepare(
    "INSERT INTO sync_runs (workspace_id,provider,status,scrape_from_date,started_at) VALUES (?,'test','completed','2026-01-01','2026-11-01')",
  ).run(ws);
  const sync = (db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number }).id;
  for (let id = 1; id <= 2; id++)
    db.prepare(
      "INSERT INTO transactions (id,workspace_id,account_number,date,processed_date,original_amount,original_currency,charged_amount,description,type,status,provider,sync_run_id,dedup_hash,kind,category_id,needs_review) VALUES (?,?,'123','2026-11-01','2026-11-01',-100,'ILS',-100,'Test merchant','normal','completed','test',?,?,'expense',?,1)",
    ).run(id, ws, sync, `test-${id}`, cats[0].id);
  return { db, ws, cats: cats.map((c) => c.id) };
}
afterEach(() => {
  connections.splice(0).forEach((db) => db.close());
});
describe("reversible transaction edits", () => {
  it("atomically categorizes a batch and undoes merchant memory too", () => {
    const { db, ws, cats } = fixture();
    const result = editTransactions(db, ws, { ids: [1, 2], categoryId: cats[1], remember: true });
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE category_id=?").get(cats[1]),
    ).toEqual({ n: 2 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM merchant_categories").get()).toEqual({ n: 1 });
    editTransactions(db, ws, { undo: result.undoToken });
    expect(
      db
        .prepare("SELECT COUNT(*) AS n FROM transactions WHERE category_id=? AND needs_review=1")
        .get(cats[0]),
    ).toEqual({ n: 2 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM merchant_categories").get()).toEqual({ n: 0 });
  });
  it("rejects foreign or missing rows without partially editing the batch", () => {
    const { db, ws, cats } = fixture();
    expect(() => editTransactions(db, ws, { ids: [1, 9999], categoryId: cats[1] })).toThrow();
    expect(db.prepare("SELECT category_id FROM transactions WHERE id=1").get()).toEqual({
      category_id: cats[0],
    });
    expect(() => editTransactions(db, ws + 100, { ids: [1], categoryId: cats[1] })).toThrow();
  });
  it("keeps the original charge intact and reports split amounts without doubling", () => {
    const { db, ws, cats } = fixture();
    const result = editTransactions(db, ws, {
      ids: [1],
      splits: [
        { categoryId: cats[0], amount: 30.01 },
        { categoryId: cats[1], amount: 69.99 },
      ],
    });
    expect(db.prepare("SELECT charged_amount FROM transactions WHERE id=1").get()).toEqual({
      charged_amount: -100,
    });
    expect(
      db.prepare("SELECT SUM(charged_amount) AS total FROM category_transactions").get(),
    ).toEqual({ total: -200 });
    expect(
      db
        .prepare(
          "SELECT SUM(charged_amount) AS total FROM category_transactions WHERE category_id=?",
        )
        .get(cats[1]),
    ).toEqual({ total: -69.99 });
    expect(() =>
      editTransactions(db, ws, {
        ids: [1],
        splits: [
          { categoryId: cats[0], amount: 30 },
          { categoryId: cats[1], amount: 69.99 },
        ],
      }),
    ).toThrow();
    editTransactions(db, ws, { undo: result.undoToken });
    expect(db.prepare("SELECT COUNT(*) AS n FROM transaction_allocations").get()).toEqual({ n: 0 });
  });
  it("does not undo over a newer edit", () => {
    const { db, ws, cats } = fixture();
    const first = editTransactions(db, ws, { ids: [1], categoryId: cats[1] });
    editTransactions(db, ws, { ids: [1], categoryId: cats[0] });
    expect(() => editTransactions(db, ws, { undo: first.undoToken })).toThrow(/changed/);
  });
  it("clears split allocation when an existing editing route changes category or kind", () => {
    const { db, ws, cats } = fixture();
    editTransactions(db, ws, {
      ids: [1],
      splits: [
        { categoryId: cats[0], amount: 30 },
        { categoryId: cats[1], amount: 70 },
      ],
    });
    db.prepare("UPDATE transactions SET kind='transfer' WHERE id=1").run();
    expect(db.prepare("SELECT COUNT(*) AS n FROM transaction_allocations").get()).toEqual({ n: 0 });
  });
});
