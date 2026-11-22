import "server-only";
import { holidaySuggestions } from "@/lib/holidays";

import { getDb } from "../index";
import { loadInsights } from "@/server/insights/data";
import { israelDay } from "@/server/lib/date-utils";
import {
  detectPeriodic,
  type Charge,
  type PeriodicExpense,
  type PeriodicSuggestion,
} from "@/lib/periodic";

export function listPeriodic(workspaceId: number): PeriodicExpense[] {
  return getDb()
    .prepare(
      `SELECT id, name, amount, every_months as everyMonths, next_due as nextDue, saved_so_far as savedSoFar, auto_key as autoKey
       FROM periodic_expenses WHERE workspace_id = ? ORDER BY next_due, name`,
    )
    .all(workspaceId) as PeriodicExpense[];
}

export function upsertPeriodic(
  workspaceId: number,
  e: Omit<PeriodicExpense, "id"> & { id?: number },
) {
  const db = getDb();
  if (e.id) {
    return (
      db
        .prepare(
          "UPDATE periodic_expenses SET name = ?, amount = ?, every_months = ?, next_due = ?, saved_so_far = ? WHERE workspace_id = ? AND id = ?",
        )
        .run(e.name, e.amount, e.everyMonths, e.nextDue, e.savedSoFar, workspaceId, e.id).changes >
      0
    );
  }
  db.prepare(
    "INSERT INTO periodic_expenses (workspace_id, name, amount, every_months, next_due, saved_so_far, auto_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(workspaceId, e.name, e.amount, e.everyMonths, e.nextDue, e.savedSoFar, e.autoKey);
  return true;
}

export function deletePeriodic(workspaceId: number, id: number) {
  return (
    getDb()
      .prepare("DELETE FROM periodic_expenses WHERE workspace_id = ? AND id = ?")
      .run(workspaceId, id).changes > 0
  );
}

export function dismissSuggestion(workspaceId: number, autoKey: string) {
  getDb()
    .prepare("INSERT OR IGNORE INTO periodic_dismissed (workspace_id, auto_key) VALUES (?, ?)")
    .run(workspaceId, autoKey);
}

export function periodicSuggestions(workspaceId: number, today: string): PeriodicSuggestion[] {
  const db = getDb();
  const known = new Set([
    ...(
      db
        .prepare(
          "SELECT auto_key as k FROM periodic_expenses WHERE workspace_id = ? AND auto_key IS NOT NULL",
        )
        .all(workspaceId) as { k: string }[]
    ).map((r) => r.k),
    ...(
      db
        .prepare("SELECT auto_key as k FROM periodic_dismissed WHERE workspace_id = ?")
        .all(workspaceId) as { k: string }[]
    ).map((r) => r.k),
  ]);
  const charges = (
    db
      .prepare(
        `SELECT t.description, -t.charged_amount as amount, t.date, c.name as category
         FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.workspace_id = ? AND t.status = 'completed' AND t.kind = 'expense' AND t.is_excluded = 0 AND t.date >= date(?, '-14 months')`,
      )
      .all(workspaceId, today) as Charge[]
  ).map((c) => ({ ...c, date: israelDay(c.date) }));
  const yearly = loadInsights(workspaceId, today).series.filter((s) => s.cadence === "yearly");
  // Holiday templates come first: the big seasonal months are the ones people forget to save for.
  return [...holidaySuggestions(today, known), ...detectPeriodic(charges, yearly, today, known)];
}
