import { describe, expect, it } from "vitest";
import { dueReminders, pendingToSend } from "@/lib/bill-reminders";

const bill = (source: string, date: string, name = source, amount = 100) => ({
  source,
  name,
  amount,
  date,
});

describe("dueReminders", () => {
  it("keeps bills from today through N days ahead, soonest first", () => {
    const r = dueReminders(
      [
        bill("a", "2026-03-03"),
        bill("b", "2026-02-28"),
        bill("c", "2026-03-04"),
        bill("d", "2026-02-27"),
      ],
      "2026-02-28",
      3,
    );
    // Crosses the Feb/Mar boundary: Mar 3 is 3 days after Feb 28 (2026 is not a leap year).
    expect(r.map((x) => [x.source, x.daysLeft])).toEqual([
      ["b", 0],
      ["a", 3],
    ]);
  });

  it("is off at 0", () => {
    expect(dueReminders([bill("a", "2026-01-01")], "2026-01-01", 0)).toEqual([]);
  });

  it("a key per occurrence", () => {
    const r = dueReminders([bill("s1", "2026-01-02")], "2026-01-01", 2);
    expect(r[0].key).toBe("bill-s1-2026-01-02");
  });

  it("the same charge from two sources is reminded once", () => {
    const r = dueReminders(
      [bill("series-x", "2026-01-02", "Gym", 199.6), bill("c-4", "2026-01-02", " gym ", 200)],
      "2026-01-01",
      2,
    );
    expect(r).toHaveLength(1);
  });
});

describe("pendingToSend", () => {
  it("skips what was sent and forgets what is no longer due", () => {
    const due = dueReminders([bill("a", "2026-01-02"), bill("b", "2026-01-03")], "2026-01-01", 2);
    const { send, keep } = pendingToSend(due, ["bill-a-2026-01-02", "bill-old-2025-12-30"]);
    expect(send.map((r) => r.source)).toEqual(["b"]);
    expect(keep).toEqual(["bill-a-2026-01-02", "bill-b-2026-01-03"]);
  });
});
