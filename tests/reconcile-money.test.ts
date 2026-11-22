import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let db: import("better-sqlite3").Database;
let ws: number;
let other: number;
let ids: number[];

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const raw = (description: string, amount: number, date: string, status = "completed") => ({
  accountNumber: "C9",
  originalCurrency: "ILS",
  status: status as "completed" | "pending",
  originalAmount: amount,
  chargedAmount: amount,
  description,
  date,
  processedDate: date,
  type: "normal" as const,
});

beforeAll(async () => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-reconcile-money-"));
  db = (await import("@/server/db/index")).getDb();
  const { createSyncRun } = await import("@/server/db/queries/sync-runs");
  const { insertTransactions } = await import("@/server/db/queries/transactions");
  ws = (db.prepare("SELECT id FROM workspaces LIMIT 1").get() as { id: number }).id;
  other = Number(
    db.prepare("INSERT INTO workspaces (name, slug) VALUES ('Other', 'other')").run()
      .lastInsertRowid,
  );
  const cred = Number(
    db
      .prepare(
        "INSERT INTO bank_credentials (workspace_id, provider, label, credentials_encrypted, iv, auth_tag) VALUES (?, 'max', 'max', x'00', x'00', x'00')",
      )
      .run(ws).lastInsertRowid,
  );
  insertTransactions(
    ws,
    [
      raw("רמי לוי", -300, day(-6), "pending"),
      ...[-95, -65, -35, -5].map((d) => raw("ספוטיפיי", -30, day(d))),
    ],
    "max",
    cred,
    createSyncRun(ws, "max", cred, day(-6)),
  );
  insertTransactions(
    ws,
    [raw("רמי לוי", -300, day(-5))],
    "max",
    cred,
    createSyncRun(ws, "max", cred, day(-1)),
  );
  ids = (
    db
      .prepare(
        "SELECT id FROM transactions WHERE workspace_id=? AND description='רמי לוי' ORDER BY id",
      )
      .all(ws) as { id: number }[]
  ).map((r) => r.id);
});

const state = (id: number) => ({
  row: db
    .prepare(
      "SELECT category_id, category_source, owner, is_excluded, needs_review FROM transactions WHERE id=?",
    )
    .get(id),
  tags: db.prepare("SELECT tag FROM transaction_tags WHERE transaction_id=? ORDER BY tag").all(id),
  parts: db
    .prepare("SELECT * FROM transaction_allocations WHERE transaction_id=? ORDER BY position")
    .all(id),
  links: db.prepare("SELECT series_id FROM manual_recurring_txns WHERE transaction_id=?").all(id),
});

describe("duplicate merge money correctness", () => {
  it("carries the split, owner and recurring link, and undo restores both rows exactly", async () => {
    const { createReconcile } = await import("@/server/finance/reconcile");
    const { createManualRecurring } = await import("@/server/insights/manual-recurring");
    const [pending, booked] = ids;
    const cats = (
      db.prepare("SELECT id FROM categories WHERE workspace_id=? LIMIT 2").all(ws) as {
        id: number;
      }[]
    ).map((c) => c.id);
    const series = createManualRecurring(db, ws).create({
      name: "סופר",
      cadence: "monthly",
      startDate: day(-30),
    });
    db.prepare(
      "UPDATE transactions SET owner='דנה', category_id=?, category_source='user' WHERE id=?",
    ).run(cats[0], pending);
    db.prepare(
      "INSERT INTO transaction_tags (workspace_id, transaction_id, tag) VALUES (?, ?, 'בית')",
    ).run(ws, pending);
    db.prepare("INSERT INTO transaction_allocations VALUES (?, 0, ?, 20000), (?, 1, ?, 10000)").run(
      pending,
      cats[0],
      pending,
      cats[1],
    );
    db.prepare("INSERT INTO manual_recurring_txns (series_id, transaction_id) VALUES (?, ?)").run(
      series,
      pending,
    );
    const before = [state(pending), state(booked)];

    const r = createReconcile(db, ws);
    expect(r.pairs().map((p) => p.keepId)).toEqual([booked]);
    const { undoToken } = r.merge(booked, pending);
    const merged = state(booked);
    expect(merged.row).toMatchObject({ owner: "דנה", category_id: cats[0], is_excluded: 0 });
    expect(merged.tags).toEqual([{ tag: "בית" }]);
    expect(merged.parts.map((p) => (p as { amount_cents: number }).amount_cents)).toEqual([
      20000, 10000,
    ]);
    expect(merged.links).toEqual([{ series_id: series }]);
    expect(state(pending).row).toMatchObject({ is_excluded: 1 });

    // Another workspace cannot use the token or touch these rows.
    expect(() => createReconcile(db, other).undo(undoToken)).toThrow();
    expect(() => createReconcile(db, other).merge(booked, pending)).toThrow();

    r.undo(undoToken);
    expect([state(pending), state(booked)]).toEqual(before);
  });
});

describe("manual recurring vs auto-detection", () => {
  it("a series made by hand owns its charges, so they are not detected a second time", async () => {
    const { loadInsights } = await import("@/server/insights/data");
    const { createManualRecurring } = await import("@/server/insights/manual-recurring");
    const spotify = () =>
      loadInsights(ws, day(0)).series.filter(
        (s) => s.merchant.includes("ספוטיפיי") || s.merchant === "מוזיקה",
      );
    expect(spotify()).toHaveLength(1); // auto-detected on its own

    const m = createManualRecurring(db, ws);
    const sid = m.create({ name: "מוזיקה", cadence: "monthly", startDate: day(-95) });
    for (const t of db
      .prepare("SELECT id FROM transactions WHERE workspace_id=? AND description='ספוטיפיי'")
      .all(ws) as { id: number }[])
      m.setAttached(sid, t.id, true);
    expect(spotify().map((s) => [s.merchant, s.expectedAmount])).toEqual([["מוזיקה", 30]]);
    // Attaching another workspace's row is refused.
    expect(() => createManualRecurring(db, other).setAttached(sid, ids[0], true)).toThrow();
  });
});
