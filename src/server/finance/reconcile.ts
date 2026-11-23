import "server-only";

import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { addDays, daysBetween, israelToday } from "../lib/date-utils";
import { amountTolerance, merchantScore } from "./pairing";

export interface DupRow {
  id: number;
  account: string;
  currency: string;
  amount: number;
  date: string;
  status: "pending" | "completed";
  provider: string;
  syncRunId: number;
  description: string;
}
export interface DupPair {
  a: DupRow;
  b: DupRow;
  /** The row to keep by default: the booked one, else the bank's over a file import, else the older. */
  keepId: number;
}

const WINDOW_DAYS = 3;
// A pending charge often books at a slightly different amount (tip, FX); anything else must match to the agora.
const PENDING_DRIFT = 0.15;

export const pairKey = (x: number, y: number) => (x < y ? `${x}-${y}` : `${y}-${x}`);

function keeper(a: DupRow, b: DupRow): number {
  if (a.status !== b.status) return a.status === "completed" ? a.id : b.id;
  if ((a.provider === "file") !== (b.provider === "file"))
    return a.provider === "file" ? b.id : a.id;
  return Math.min(a.id, b.id);
}

/**
 * Likely duplicate pairs: same account and currency, same sign, dates within 3 days, amounts equal (or close when one
 * is still pending), and from different syncs or states, so two coffees bought in one sync never pair. Each row joins
 * one pair at most, the closest first.
 */
export function findDuplicatePairs(rows: DupRow[], dismissed: Set<string>): DupPair[] {
  const candidates: { a: DupRow; b: DupRow; score: number }[] = [];
  const byAccount = new Map<string, DupRow[]>();
  for (const r of rows) {
    const k = `${r.account}|${r.currency}`;
    byAccount.set(k, [...(byAccount.get(k) ?? []), r]);
  }
  for (const list of byAccount.values()) {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]];
        if (Math.sign(a.amount) !== Math.sign(b.amount)) continue;
        if (a.status === b.status && a.syncRunId === b.syncRunId && a.provider === b.provider)
          continue;
        if (dismissed.has(pairKey(a.id, b.id))) continue;
        const gap = Math.abs(daysBetween(a.date, b.date));
        if (gap > WINDOW_DAYS) continue;
        const diff = Math.abs(a.amount - b.amount);
        const exact = diff <= amountTolerance(a.amount);
        const drift = a.status !== b.status && diff <= Math.abs(a.amount) * PENDING_DRIFT;
        const names = merchantScore(a.description, b.description);
        // A near (not exact) amount needs the same merchant to count.
        if (!exact && !(drift && names > 0)) continue;
        candidates.push({ a, b, score: (exact ? 4 : 0) + names * 2 - gap });
      }
  }
  candidates.sort((x, y) => y.score - x.score);
  const used = new Set<number>();
  const out: DupPair[] = [];
  for (const c of candidates) {
    if (used.has(c.a.id) || used.has(c.b.id)) continue;
    used.add(c.a.id).add(c.b.id);
    out.push({ a: c.a, b: c.b, keepId: keeper(c.a, c.b) });
  }
  return out;
}

export class ReconcileError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

type Snap = {
  id: number;
  category_id: number | null;
  category_source: string | null;
  owner: string | null;
  is_excluded: number;
  needs_review: number;
  tags: string[];
  parts: { position: number; category_id: number | null; amount_cents: number }[];
  links: number[];
};
type Undo = { rows: Snap[]; dismissed: [number, number][] };

export function createReconcile(db: Database.Database, ws: number) {
  const snap = (id: number): Snap => {
    const r = db
      .prepare(
        "SELECT id,category_id,category_source,owner,is_excluded,needs_review FROM transactions WHERE workspace_id=? AND id=?",
      )
      .get(ws, id) as Omit<Snap, "tags" | "parts" | "links"> | undefined;
    if (!r) throw new ReconcileError("Transaction not found", 404);
    return {
      ...r,
      tags: (
        db
          .prepare("SELECT tag FROM transaction_tags WHERE transaction_id=? ORDER BY tag")
          .all(id) as { tag: string }[]
      ).map((t) => t.tag),
      parts: db
        .prepare(
          "SELECT position,category_id,amount_cents FROM transaction_allocations WHERE transaction_id=? ORDER BY position",
        )
        .all(id) as Snap["parts"],
      links: (
        db
          .prepare("SELECT series_id FROM manual_recurring_txns WHERE transaction_id=?")
          .all(id) as { series_id: number }[]
      ).map((l) => l.series_id),
    };
  };
  const restore = (s: Snap) => {
    db.prepare(
      "UPDATE transactions SET category_id=?,category_source=?,owner=?,is_excluded=?,needs_review=?,updated_at=datetime('now') WHERE workspace_id=? AND id=?",
    ).run(s.category_id, s.category_source, s.owner, s.is_excluded, s.needs_review, ws, s.id);
    db.prepare("DELETE FROM transaction_tags WHERE transaction_id=?").run(s.id);
    for (const tag of s.tags)
      db.prepare(
        "INSERT INTO transaction_tags (workspace_id,transaction_id,tag) VALUES (?,?,?)",
      ).run(ws, s.id, tag);
    db.prepare("DELETE FROM transaction_allocations WHERE transaction_id=?").run(s.id);
    for (const p of s.parts)
      db.prepare("INSERT INTO transaction_allocations VALUES (?,?,?,?)").run(
        s.id,
        p.position,
        p.category_id,
        p.amount_cents,
      );
    db.prepare("DELETE FROM manual_recurring_txns WHERE transaction_id=?").run(s.id);
    for (const sid of s.links)
      db.prepare("INSERT INTO manual_recurring_txns (series_id,transaction_id) VALUES (?,?)").run(
        sid,
        s.id,
      );
  };
  const record = (u: Undo) => {
    const token = randomUUID();
    db.prepare("INSERT INTO reconcile_undo (token,workspace_id,before_json) VALUES (?,?,?)").run(
      token,
      ws,
      JSON.stringify(u),
    );
    db.prepare("DELETE FROM reconcile_undo WHERE created_at<datetime('now','-1 day')").run();
    return { undoToken: token };
  };
  const hide = (id: number) =>
    db
      .prepare(
        "UPDATE transactions SET is_excluded=1,updated_at=datetime('now') WHERE workspace_id=? AND id=?",
      )
      .run(ws, id);

  const dismissedSet = () =>
    new Set(
      (
        db.prepare("SELECT txn_a,txn_b FROM reconcile_dismissed WHERE workspace_id=?").all(ws) as {
          txn_a: number;
          txn_b: number;
        }[]
      ).map((d) => pairKey(d.txn_a, d.txn_b)),
    );

  return {
    pairs(): DupPair[] {
      const rows = db
        .prepare(
          `SELECT id, account_number AS account, COALESCE(charged_currency, original_currency) AS currency,
                  charged_amount AS amount, substr(date,1,10) AS date, status, provider,
                  sync_run_id AS syncRunId, description
           FROM transactions
           WHERE workspace_id=? AND is_excluded=0 AND date >= ?
           ORDER BY date`,
        )
        .all(ws, addDays(israelToday(), -180)) as DupRow[];
      return findDuplicatePairs(rows, dismissedSet());
    },
    stale(days: number, today: string) {
      return db
        .prepare(
          `SELECT id, description, charged_amount AS amount, substr(date,1,10) AS date, account_number AS account
           FROM transactions WHERE workspace_id=? AND status='pending' AND is_excluded=0 AND substr(date,1,10) < ?
           ORDER BY date`,
        )
        .all(ws, addDays(today, -days)) as {
        id: number;
        description: string;
        amount: number;
        date: string;
        account: string;
      }[];
    },
    /** Keeps one row, carries the other's category, tags, owner, split and recurring links over, and hides the other. */
    merge(keepId: number, dropId: number) {
      if (keepId === dropId) throw new ReconcileError("Choose two different transactions");
      return db.transaction(() => {
        const keep = snap(keepId);
        const drop = snap(dropId);
        if (!keep.category_id && drop.category_id)
          db.prepare(
            "UPDATE transactions SET category_id=?,category_source=?,needs_review=? WHERE workspace_id=? AND id=?",
          ).run(drop.category_id, drop.category_source, drop.needs_review, ws, keepId);
        if (!keep.owner && drop.owner)
          db.prepare("UPDATE transactions SET owner=? WHERE workspace_id=? AND id=?").run(
            drop.owner,
            ws,
            keepId,
          );
        for (const tag of drop.tags)
          db.prepare(
            "INSERT OR IGNORE INTO transaction_tags (workspace_id,transaction_id,tag) VALUES (?,?,?)",
          ).run(ws, keepId, tag);
        const keepCents = Math.round(
          Math.abs(
            (
              db.prepare("SELECT charged_amount AS a FROM transactions WHERE id=?").get(keepId) as {
                a: number;
              }
            ).a,
          ) * 100,
        );
        // A split only carries over when its parts still add up to the kept row's amount.
        if (
          !keep.parts.length &&
          drop.parts.length &&
          drop.parts.reduce((s, p) => s + p.amount_cents, 0) === keepCents
        )
          for (const p of drop.parts)
            db.prepare("INSERT INTO transaction_allocations VALUES (?,?,?,?)").run(
              keepId,
              p.position,
              p.category_id,
              p.amount_cents,
            );
        for (const sid of drop.links)
          db.prepare(
            "INSERT OR IGNORE INTO manual_recurring_txns (series_id,transaction_id) VALUES (?,?)",
          ).run(sid, keepId);
        hide(dropId);
        return record({ rows: [keep, drop], dismissed: [] });
      })();
    },
    dismiss(x: number, y: number) {
      if (x === y) throw new ReconcileError("Choose two different transactions");
      return db.transaction(() => {
        snap(x);
        snap(y);
        const [a, b] = x < y ? [x, y] : [y, x];
        db.prepare(
          "INSERT OR IGNORE INTO reconcile_dismissed (workspace_id,txn_a,txn_b) VALUES (?,?,?)",
        ).run(ws, a, b);
        return record({ rows: [], dismissed: [[a, b]] });
      })();
    },
    /** Hides rows (a bad row, or pending rows that never settled). Undo shows them again. */
    remove(ids: number[]) {
      if (!ids.length || ids.length > 500) throw new ReconcileError("Choose 1–500 transactions");
      return db.transaction(() => {
        const rows = ids.map(snap);
        ids.forEach(hide);
        return record({ rows, dismissed: [] });
      })();
    },
    undo(token: string) {
      return db.transaction(() => {
        const h = db
          .prepare(
            "SELECT before_json FROM reconcile_undo WHERE token=? AND workspace_id=? AND created_at>=datetime('now','-1 day')",
          )
          .get(token, ws) as { before_json: string } | undefined;
        if (!h) throw new ReconcileError("Undo expired or already used", 409);
        const u = JSON.parse(h.before_json) as Undo;
        u.rows.forEach(restore);
        for (const [a, b] of u.dismissed)
          db.prepare(
            "DELETE FROM reconcile_dismissed WHERE workspace_id=? AND txn_a=? AND txn_b=?",
          ).run(ws, a, b);
        db.prepare("DELETE FROM reconcile_undo WHERE token=?").run(token);
        return { undoToken: null };
      })();
    },
  };
}
