import { beforeEach, afterEach, it, expect, vi } from "vitest";
import Database from "better-sqlite3";
const holder = vi.hoisted(() => ({ db: null as unknown as Database.Database }));
vi.mock("@/server/db", () => ({ getDb: () => holder.db }));
import { runMigrations } from "@/server/db/migrate";
import {
  controlCommand,
  controlPayload,
  previewGoalRule,
  applyAutomaticGoalRules,
} from "@/server/db/queries/financial-control";
import { listGoals } from "@/server/db/queries/plan";
import { cashAhead } from "@/lib/cash-ahead";
import { commitmentDates, validDay } from "@/lib/financial-control";
import { getCategoryBreakdown } from "@/server/db/queries/transactions";

beforeEach(() => {
  holder.db = new Database(":memory:");
  runMigrations(holder.db);
  holder.db.pragma("foreign_keys=ON");
  holder.db.exec(
    "INSERT INTO goals(id,workspace_id,name,target_amount,target_date,saved_amount) VALUES (1,1,'Goal',10000,'2027-01',1000); INSERT INTO sync_runs(id,workspace_id,provider,status,scrape_from_date,started_at) VALUES (1,1,'test','completed','2026-01-01','2026-11-01');",
  );
  const insert = holder.db.prepare(
    "INSERT INTO transactions(id,workspace_id,account_number,date,processed_date,original_amount,original_currency,charged_amount,description,type,status,provider,sync_run_id,dedup_hash,kind) VALUES (?,1,'123','2026-11-01','2026-11-01',?,'ILS',?,'Savings','normal','completed','test',1,?,?)",
  );
  insert.run(1, -100, -100, "a", "transfer");
  insert.run(2, 50, 50, "b", "transfer");
  insert.run(3, -200, -200, "c", "expense");
  insert.run(4, 40, 40, "d", "expense");
});
afterEach(() => holder.db.close());
it("deducts card bills, bank obligations and explicit cash reserves, not expected salary", () => {
  const result = cashAhead({
    today: "2026-11-01",
    payday: 10,
    bank: 10000,
    bills: [{ date: "2026-11-05", total: 1000 }],
    monthlyIncome: 20000,
    incomeSoFar: 0,
    bankDebits: [
      { date: "2026-11-04", total: 2000 },
      { date: "2026-11-20", total: 999 },
    ],
    reservedCash: 500,
  });
  expect(result.safeToSpend).toBe(6500);
});
it("rejects invalid dates and projects monthly renewals without month overflow", () => {
  expect(validDay("2026-02-30")).toBe(false);
  expect(
    commitmentDates(
      { nextDate: "2026-01-31", cadence: "monthly", status: "active" },
      "2026-02-01",
      "2026-03-31",
    ),
  ).toEqual(["2026-02-28", "2026-03-31"]);
});
it("links deposits and withdrawals without changing the opening goal balance", () => {
  controlCommand(1, { action: "link", transactionId: 1, goalId: 1, contribution: 100 });
  controlCommand(1, { action: "link", transactionId: 2, goalId: 1, contribution: -50 });
  expect(listGoals(1)[0]).toMatchObject({ openingSavedAmount: 1000, savedAmount: 1050 });
  expect(() =>
    controlCommand(2, { action: "link", transactionId: 1, goalId: 1, contribution: 100 }),
  ).toThrow();
  expect(() =>
    controlCommand(1, { action: "link", transactionId: 1, goalId: 1, contribution: 101 }),
  ).toThrow();
});
it("previews before applying and permits conflict-safe undo", () => {
  const rule = {
    goalId: 1,
    account: "123",
    description: "Savings",
    direction: 1,
    fromDate: "2026-01-01",
  };
  const matches = previewGoalRule(1, rule);
  expect(matches).toHaveLength(1);
  expect(() => controlCommand(1, { action: "rule-apply", rule, expectedIds: [2] })).toThrow();
  const result = controlCommand(1, {
    action: "rule-apply",
    rule,
    expectedIds: matches.map((m) => m.transactionId),
  }) as { undoId: number };
  expect(listGoals(1)[0].savedAmount).toBe(1100);
  controlCommand(1, { action: "undo-rule", id: result.undoId });
  expect(listGoals(1)[0].savedAmount).toBe(1000);
});
it("does not execute nonautomatic rules and applies opted-in rules idempotently", () => {
  holder.db
    .prepare(
      "INSERT INTO goal_rules(workspace_id,goal_id,account,description,direction,from_date,automatic) VALUES (1,1,'123','Savings',1,'2026-01-01',0)",
    )
    .run();
  applyAutomaticGoalRules(1);
  expect(listGoals(1)[0].savedAmount).toBe(1000);
  holder.db.exec("UPDATE goal_rules SET automatic=1");
  applyAutomaticGoalRules(1);
  applyAutomaticGoalRules(1);
  expect(listGoals(1)[0].savedAmount).toBe(1100);
});
it("nets refunds consistently in reports and category budgets", () => {
  const payload = controlPayload(1, "2026-11");
  expect(payload.drivers.reduce((s, d) => s + d.current, 0)).toBe(160);
  expect(
    getCategoryBreakdown(1, "2026-11-01", "2026-11-30").reduce((s, c) => s + c.amount, 0),
  ).toBe(160);
});
