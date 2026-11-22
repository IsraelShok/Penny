import "server-only";

import type Database from "better-sqlite3";
import type { Cadence, Series } from "./recurring";

export interface ManualItem {
  id: number;
  name: string;
  account: string;
  currency: string;
  cadence: Cadence;
  /** Override; null = the mean of the attached charges. */
  amount: number | null;
  /** Override; null = the day of the latest attached charge. */
  dayOfMonth: number | null;
  startDate: string;
}
export interface AttachedTxn {
  id: number;
  date: string;
  amount: number;
  description: string;
}

const CADENCES: Cadence[] = ["weekly", "monthly", "yearly"];

/** A manual item as a Series the forecasts already understand; always "suggested", since the person vouched for it. */
export function buildManualSeries(
  item: ManualItem,
  attached: AttachedTxn[],
): Series & { manualId: number } {
  const sorted = [...attached].sort((a, b) => a.date.localeCompare(b.date));
  let lastDate = sorted.length ? sorted[sorted.length - 1].date.slice(0, 10) : item.startDate;
  if (item.dayOfMonth && item.cadence !== "weekly") {
    const [y, m] = lastDate.split("-").map(Number);
    const monthDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
    lastDate = `${lastDate.slice(0, 8)}${String(Math.min(item.dayOfMonth, monthDays)).padStart(2, "0")}`;
  }
  const mean = sorted.length
    ? sorted.reduce((s, t) => s + Math.abs(t.amount), 0) / sorted.length
    : 0;
  return {
    manualId: item.id,
    merchant: item.name,
    account: item.account,
    currency: item.currency,
    cadence: item.cadence,
    expectedAmount: item.amount ?? mean,
    occurrences: sorted.length,
    lastDate,
    status: "suggested",
  };
}

export class ManualRecurringError extends Error {}

type Input = {
  name?: unknown;
  account?: unknown;
  cadence?: unknown;
  amount?: unknown;
  dayOfMonth?: unknown;
  startDate?: unknown;
};

function clean(input: Input, partial: boolean) {
  const out: Record<string, string | number | null> = {};
  if (input.name !== undefined || !partial) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 80)
      throw new ManualRecurringError("Name is required");
    out.name = input.name.trim();
  }
  if (input.account !== undefined) {
    if (input.account !== null && typeof input.account !== "string")
      throw new ManualRecurringError("Invalid account");
    out.account = ((input.account as string | null) ?? "").slice(0, 40);
  }
  if (input.cadence !== undefined || !partial) {
    if (!CADENCES.includes(input.cadence as Cadence))
      throw new ManualRecurringError("Invalid cadence");
    out.cadence = input.cadence as string;
  }
  if (input.amount !== undefined) {
    if (
      input.amount !== null &&
      (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount <= 0)
    )
      throw new ManualRecurringError("Amount must be positive");
    out.amount = input.amount as number | null;
  }
  if (input.dayOfMonth !== undefined) {
    if (
      input.dayOfMonth !== null &&
      (!Number.isInteger(input.dayOfMonth) ||
        (input.dayOfMonth as number) < 1 ||
        (input.dayOfMonth as number) > 31)
    )
      throw new ManualRecurringError("Day must be 1–31");
    out.day_of_month = input.dayOfMonth as number | null;
  }
  if (input.startDate !== undefined || !partial) {
    if (typeof input.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate))
      throw new ManualRecurringError("Invalid start date");
    out.start_date = input.startDate;
  }
  return out;
}

export function createManualRecurring(db: Database.Database, ws: number) {
  const items = () =>
    db
      .prepare(
        `SELECT id, name, account, currency, cadence, amount, day_of_month AS dayOfMonth, start_date AS startDate
         FROM manual_recurring WHERE workspace_id=? AND deleted_at IS NULL ORDER BY name`,
      )
      .all(ws) as ManualItem[];
  const attached = (id: number) =>
    db
      .prepare(
        `SELECT t.id, substr(t.date,1,10) AS date, t.charged_amount AS amount, t.description
         FROM manual_recurring_txns m JOIN transactions t ON t.id = m.transaction_id
         WHERE m.series_id=? AND t.workspace_id=? AND t.is_excluded=0 ORDER BY t.date DESC`,
      )
      .all(id, ws) as AttachedTxn[];
  const own = (id: unknown) => {
    if (!Number.isSafeInteger(id)) throw new ManualRecurringError("Invalid series");
    const r = db
      .prepare("SELECT id FROM manual_recurring WHERE workspace_id=? AND id=?")
      .get(ws, id as number);
    if (!r) throw new ManualRecurringError("Series not found");
    return id as number;
  };
  return {
    list() {
      return items().map((i) => {
        const txns = attached(i.id);
        return { ...i, transactions: txns, series: buildManualSeries(i, txns) };
      });
    },
    /** Series for the forecasts, plus the transaction ids they own so auto-detection doesn't count them again. */
    forInsights() {
      const owned = new Set<number>();
      const series = items().map((i) => {
        const txns = attached(i.id);
        txns.forEach((t) => owned.add(t.id));
        return buildManualSeries(i, txns);
      });
      return { series, owned };
    },
    /** Recent charges that could belong to a series: not attached yet, newest first, name match first. */
    candidates(id: unknown) {
      const sid = own(id);
      const { name, account } = db
        .prepare("SELECT name, account FROM manual_recurring WHERE id=?")
        .get(sid) as { name: string; account: string };
      return db
        .prepare(
          `SELECT id, substr(date,1,10) AS date, charged_amount AS amount, description FROM transactions
           WHERE workspace_id=? AND is_excluded=0 AND charged_amount < 0 AND date >= date('now','-400 days')
             AND (?='' OR account_number=?)
             AND id NOT IN (SELECT transaction_id FROM manual_recurring_txns WHERE series_id=?)
           ORDER BY instr(lower(description), lower(?)) = 0, date DESC LIMIT 30`,
        )
        .all(ws, account, account, sid, name) as AttachedTxn[];
    },
    create(input: Input) {
      const v = clean(input, false);
      return Number(
        db
          .prepare(
            `INSERT INTO manual_recurring (workspace_id, name, account, cadence, amount, day_of_month, start_date)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            ws,
            v.name,
            v.account ?? "",
            v.cadence,
            v.amount ?? null,
            v.day_of_month ?? null,
            v.start_date,
          ).lastInsertRowid,
      );
    },
    update(id: unknown, input: Input) {
      const sid = own(id);
      const v = clean(input, true);
      const keys = Object.keys(v);
      if (!keys.length) return;
      db.prepare(
        `UPDATE manual_recurring SET ${keys.map((k) => `${k}=?`).join(",")} WHERE workspace_id=? AND id=?`,
      ).run(...keys.map((k) => v[k]), ws, sid);
    },
    /** Soft delete; restore = setDeleted(id, false). */
    setDeleted(id: unknown, deleted: boolean) {
      const sid = own(id);
      db.prepare(
        `UPDATE manual_recurring SET deleted_at = ${deleted ? "datetime('now')" : "NULL"} WHERE workspace_id=? AND id=?`,
      ).run(ws, sid);
    },
    setAttached(id: unknown, transactionId: unknown, attach: boolean) {
      const sid = own(id);
      if (
        !Number.isSafeInteger(transactionId) ||
        !db
          .prepare("SELECT 1 FROM transactions WHERE workspace_id=? AND id=?")
          .get(ws, transactionId as number)
      )
        throw new ManualRecurringError("Transaction not found");
      db.prepare(
        attach
          ? "INSERT OR IGNORE INTO manual_recurring_txns (series_id, transaction_id) VALUES (?, ?)"
          : "DELETE FROM manual_recurring_txns WHERE series_id=? AND transaction_id=?",
      ).run(sid, transactionId as number);
    },
  };
}
