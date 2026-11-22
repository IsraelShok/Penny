import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let ws: number;

beforeAll(async () => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-bills-"));
  const db = (await import("@/server/db/index")).getDb();
  ws = (db.prepare("SELECT id FROM workspaces LIMIT 1").get() as { id: number }).id;
  const add = db.prepare(
    "INSERT INTO commitments (workspace_id,name,amount,next_date,cadence,source,status) VALUES (?,?,?,?,?,'bank',?)",
  );
  add.run(ws, "שכר דירה", 5200, "2026-01-31", "monthly", "active"); // month-end: Feb 28
  add.run(ws, "ביטוח רכב", 3100, "2026-03-02", "yearly", "active");
  add.run(ws, "חדר כושר", 250, "2026-02-27", "monthly", "cancelled");
});

describe("bill reminders from stored commitments", () => {
  it("clamps a 31st to the end of February and crosses into March", async () => {
    const { billReminders } = await import("@/server/insights/bill-reminders");
    const due = billReminders(ws, "2026-02-27").map((b) => [b.name, b.date, b.daysLeft, b.amount]);
    expect(due).toEqual([["שכר דירה", "2026-02-28", 1, 5200]]);
    const { setWorkspaceSetting } = await import("@/server/db/queries/settings");
    setWorkspaceSetting(ws, "bill_reminder_days", "3");
    expect(billReminders(ws, "2026-02-27").map((b) => b.date)).toEqual([
      "2026-02-28",
      "2026-03-02",
    ]);
  });

  it("keeps one key per occurrence from day to day, so it is reminded once", async () => {
    const { billReminders } = await import("@/server/insights/bill-reminders");
    const { pendingToSend } = await import("@/lib/bill-reminders");
    const first = pendingToSend(billReminders(ws, "2026-02-27"), []);
    const next = pendingToSend(billReminders(ws, "2026-02-28"), first.keep);
    expect(first.send).toHaveLength(2);
    expect(next.send).toEqual([]);
  });

  it("is silent when turned off, and ignores a garbage setting", async () => {
    const { billReminders } = await import("@/server/insights/bill-reminders");
    const { setWorkspaceSetting } = await import("@/server/db/queries/settings");
    setWorkspaceSetting(ws, "bill_reminder_days", "0");
    expect(billReminders(ws, "2026-02-27")).toEqual([]);
    setWorkspaceSetting(ws, "bill_reminder_days", "999");
    expect(billReminders(ws, "2026-02-27").map((b) => b.date)).toEqual(["2026-02-28"]); // default 2
  });
});
