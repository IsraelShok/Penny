import { describe, it, expect, beforeAll } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import type { DupRow } from "@/server/finance/reconcile";

let ws: number;
let db: import("better-sqlite3").Database;
let mod: typeof import("@/server/finance/reconcile");

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const txn = (
  accountNumber: string,
  description: string,
  chargedAmount: number,
  date: string,
  status: "completed" | "pending" = "completed",
) => ({
  accountNumber,
  originalCurrency: "ILS",
  status,
  originalAmount: chargedAmount,
  chargedAmount,
  description,
  date,
  processedDate: date,
  type: "normal" as const,
});
const id = (description: string, status = "completed") =>
  (
    db
      .prepare("SELECT id FROM transactions WHERE workspace_id=? AND description=? AND status=?")
      .get(ws, description, status) as { id: number }
  ).id;

beforeAll(async () => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-reconcile-"));
  db = (await import("@/server/db/index")).getDb();
  mod = await import("@/server/finance/reconcile");
  const { createSyncRun } = await import("@/server/db/queries/sync-runs");
  const { insertTransactions } = await import("@/server/db/queries/transactions");
  ws = (db.prepare("SELECT id FROM workspaces LIMIT 1").get() as { id: number }).id;
  const cred = db
    .prepare(
      "INSERT INTO bank_credentials (workspace_id, provider, label, credentials_encrypted, iv, auth_tag) VALUES (?, 'max', 'max', x'00', x'00', x'00')",
    )
    .run(ws).lastInsertRowid as number;
  insertTransactions(
    ws,
    [
      txn("C1", "ארומה תל אביב", -42, day(-5), "pending"),
      txn("C1", "סופר פארם", -80, day(-40), "pending"),
      txn("C1", "קפה", -12, day(-2)),
      txn("C1", "קפה", -12, day(-2)),
    ],
    "max",
    cred,
    createSyncRun(ws, "max", cred, day(-5)),
  );
  insertTransactions(
    ws,
    [txn("C1", "ארומה תל אביב", -45, day(-4)), txn("C1", "נטפליקס", -50, day(-3))],
    "max",
    cred,
    createSyncRun(ws, "max", cred, day(-1)),
  );
});

describe("findDuplicatePairs", () => {
  const row = (p: Partial<DupRow>): DupRow => ({
    id: 1,
    account: "A",
    currency: "ILS",
    amount: -100,
    date: "2026-01-10",
    status: "completed",
    provider: "max",
    syncRunId: 1,
    description: "שופרסל",
    ...p,
  });

  it("pairs a pending charge with its booked version and keeps the booked one", () => {
    const pairs = mod.findDuplicatePairs(
      [
        row({ id: 1, status: "pending", amount: -95 }),
        row({ id: 2, date: "2026-01-12", syncRunId: 2 }),
      ],
      new Set(),
    );
    expect(pairs).toHaveLength(1);
    expect(pairs[0].keepId).toBe(2);
  });

  it("keeps the bank row over a file import, and skips same-sync twins, far dates, other accounts and dismissed pairs", () => {
    const file = row({ id: 3, provider: "file", syncRunId: 9 });
    expect(mod.findDuplicatePairs([row({ id: 4 }), file], new Set())[0].keepId).toBe(4);
    expect(mod.findDuplicatePairs([row({ id: 1 }), row({ id: 2 })], new Set())).toEqual([]);
    expect(
      mod.findDuplicatePairs(
        [row({ id: 1 }), row({ id: 2, syncRunId: 2, date: "2026-01-20" })],
        new Set(),
      ),
    ).toEqual([]);
    expect(
      mod.findDuplicatePairs(
        [row({ id: 1 }), row({ id: 2, syncRunId: 2, account: "B" })],
        new Set(),
      ),
    ).toEqual([]);
    expect(
      mod.findDuplicatePairs([row({ id: 1 }), row({ id: 2, syncRunId: 2 })], new Set(["1-2"])),
    ).toEqual([]);
  });

  it("needs the same merchant when the amounts only nearly match", () => {
    expect(
      mod.findDuplicatePairs(
        [
          row({ id: 1, status: "pending", amount: -95 }),
          row({ id: 2, syncRunId: 2, description: "רמי לוי" }),
        ],
        new Set(),
      ),
    ).toEqual([]);
  });
});

describe("reconcile actions", () => {
  it("finds the pending/booked pair in the database, not the two coffees from one sync", () => {
    const r = mod.createReconcile(db, ws);
    const pairs = r.pairs();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].keepId).toBe(id("ארומה תל אביב"));
  });

  it("merges: carries the category and tags over, hides the extra row, and undo restores both", () => {
    const r = mod.createReconcile(db, ws);
    const keep = id("ארומה תל אביב");
    const drop = id("ארומה תל אביב", "pending");
    const cat = (
      db.prepare("SELECT id FROM categories WHERE workspace_id=? LIMIT 1").get(ws) as { id: number }
    ).id;
    db.prepare("UPDATE transactions SET category_id=?, category_source='user' WHERE id=?").run(
      cat,
      drop,
    );
    db.prepare(
      "INSERT INTO transaction_tags (workspace_id, transaction_id, tag) VALUES (?, ?, 'trip')",
    ).run(ws, drop);

    const { undoToken } = r.merge(keep, drop);
    const kept = db.prepare("SELECT category_id FROM transactions WHERE id=?").get(keep) as {
      category_id: number;
    };
    expect(kept.category_id).toBe(cat);
    expect(db.prepare("SELECT tag FROM transaction_tags WHERE transaction_id=?").all(keep)).toEqual(
      [{ tag: "trip" }],
    );
    expect(
      (
        db.prepare("SELECT is_excluded FROM transactions WHERE id=?").get(drop) as {
          is_excluded: number;
        }
      ).is_excluded,
    ).toBe(1);
    expect(r.pairs()).toHaveLength(0);

    r.undo(undoToken);
    expect(
      (
        db.prepare("SELECT category_id FROM transactions WHERE id=?").get(keep) as {
          category_id: number | null;
        }
      ).category_id,
    ).toBeNull();
    expect(db.prepare("SELECT tag FROM transaction_tags WHERE transaction_id=?").all(keep)).toEqual(
      [],
    );
    expect(
      (
        db.prepare("SELECT is_excluded FROM transactions WHERE id=?").get(drop) as {
          is_excluded: number;
        }
      ).is_excluded,
    ).toBe(0);
    expect(() => r.undo(undoToken)).toThrow(mod.ReconcileError);
  });

  it("remembers a dismissed pair until undone", () => {
    const r = mod.createReconcile(db, ws);
    const [a, b] = [id("ארומה תל אביב"), id("ארומה תל אביב", "pending")];
    const { undoToken } = r.dismiss(a, b);
    expect(r.pairs()).toHaveLength(0);
    r.undo(undoToken);
    expect(r.pairs()).toHaveLength(1);
  });

  it("lists pending rows older than N days and hides them with undo", () => {
    const r = mod.createReconcile(db, ws);
    const today = day(0);
    const stale = r.stale(14, today);
    expect(stale.map((s) => s.description)).toEqual(["סופר פארם"]);
    const { undoToken } = r.remove(stale.map((s) => s.id));
    expect(r.stale(14, today)).toEqual([]);
    r.undo(undoToken);
    expect(r.stale(14, today)).toHaveLength(1);
  });
});

describe("generic descriptions", () => {
  it("keeps generic rows out of auto-categorization", async () => {
    const g = await import("@/server/lib/generic-descriptions");
    const { getTransactionsForCategorization } = await import("@/server/db/queries/transactions");
    expect(g.isGeneric("העברה 1234", ["העברה"])).toBe(true);
    expect(g.isGeneric("שופרסל", ["העברה"])).toBe(false);
    const coffee = id("נטפליקס");
    expect(getTransactionsForCategorization(ws, [coffee])).toHaveLength(1);
    expect(g.addGenericPattern(ws, "  נטפליקס ")).toBe("נטפליקס");
    expect(getTransactionsForCategorization(ws, [coffee])).toHaveLength(0);
    g.removeGenericPattern(ws, "נטפליקס");
    expect(getTransactionsForCategorization(ws, [coffee])).toHaveLength(1);
  });
});

describe("manual recurring", () => {
  it("builds a series from overrides or attached charges", async () => {
    const { buildManualSeries } = await import("@/server/insights/manual-recurring");
    const item = {
      id: 1,
      name: "ועד בית",
      account: "",
      currency: "ILS",
      cadence: "monthly" as const,
      amount: null,
      dayOfMonth: null,
      startDate: "2026-01-01",
    };
    const charges = [
      { id: 1, date: "2026-02-03", amount: -100, description: "x" },
      { id: 2, date: "2026-03-05", amount: -120, description: "x" },
    ];
    expect(buildManualSeries(item, charges)).toMatchObject({
      expectedAmount: 110,
      lastDate: "2026-03-05",
      status: "suggested",
    });
    expect(buildManualSeries({ ...item, amount: 90, dayOfMonth: 31 }, charges)).toMatchObject({
      expectedAmount: 90,
      lastDate: "2026-03-31",
    });
    expect(
      buildManualSeries({ ...item, dayOfMonth: 31 }, [{ ...charges[0], date: "2026-02-10" }])
        .lastDate,
    ).toBe("2026-02-28");
    expect(buildManualSeries({ ...item, amount: 50 }, []).lastDate).toBe("2026-01-01");
  });

  it("flows into insights, owns its attached charges, and soft-deletes", async () => {
    const { createManualRecurring } = await import("@/server/insights/manual-recurring");
    const { loadInsights } = await import("@/server/insights/data");
    const m = createManualRecurring(db, ws);
    const sid = m.create({ name: "סטרימינג", cadence: "monthly", startDate: day(-3) });
    m.setAttached(sid, id("נטפליקס"), true);
    expect(m.candidates(sid).some((c) => c.id === id("נטפליקס"))).toBe(false);
    const found = loadInsights(ws, day(0)).series.find((s) => s.merchant === "סטרימינג");
    expect(found).toMatchObject({ expectedAmount: 50, cadence: "monthly" });
    m.update(sid, { amount: 55 });
    expect(
      loadInsights(ws, day(0)).series.find((s) => s.merchant === "סטרימינג")?.expectedAmount,
    ).toBe(55);
    m.setDeleted(sid, true);
    expect(loadInsights(ws, day(0)).series.find((s) => s.merchant === "סטרימינג")).toBeUndefined();
    m.setDeleted(sid, false);
    expect(m.list()).toHaveLength(1);
    expect(() => m.create({ name: "", cadence: "monthly", startDate: day(0) })).toThrow();
  });
});
