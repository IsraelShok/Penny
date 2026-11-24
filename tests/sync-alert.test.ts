import { describe, expect, it } from "vitest";
import { reminderDue, syncAlert } from "@/lib/sync-alert";

describe("syncAlert", () => {
  it("speaks only when a connection's state changes", () => {
    expect(
      syncAlert([
        { label: "לאומי", ok: true, wasFailing: false },
        { label: "מקס", ok: false, wasFailing: true },
      ]),
    ).toBeNull();
    const text = syncAlert([
      { label: "מקס", ok: false, wasFailing: false, reason: "הסיסמה נדחתה." },
      { label: "לאומי", ok: true, wasFailing: true },
    ])!;
    expect(text).toContain("הסנכרון של מקס נכשל.\nהסיסמה נדחתה.");
    expect(text).toContain("לאומי מסתנכרן שוב");
  });

  it("reminds on the 3rd failing day, then every 7th day after", () => {
    expect([1, 2, 3, 4, 9, 10, 11, 17, 24].filter(reminderDue)).toEqual([3, 10, 17, 24]);
    const down = { label: "מקס", ok: false, wasFailing: true, lastOk: "2026-11-14" };
    expect(syncAlert([{ ...down, failedDays: 2 }])).toBeNull();
    expect(syncAlert([{ ...down, failedDays: 4 }])).toBeNull();
    const text = syncAlert([{ ...down, failedDays: 3 }])!;
    expect(text).toContain("מקס לא הסתנכרן מאז 14.11.2026");
    expect(text).toContain("לפתוח את האפליקציה");
    expect(syncAlert([{ ...down, failedDays: 10 }])).toContain("14.11.2026");
  });

  it("does not repeat the reminder for a retry on the same day, and never names the product", () => {
    const down = { label: "מקס", ok: false, wasFailing: true, failedDays: 3 };
    expect(syncAlert([{ ...down, failedEarlierToday: true }])).toBeNull();
    const never = syncAlert([{ ...down, lastOk: null }])!;
    expect(never).toContain("עדיין לא הסתנכרן אף פעם");
    expect(never).not.toMatch(/penny|פני/i);
  });

  it("says nothing about a streak once the connection works", () => {
    expect(syncAlert([{ label: "מקס", ok: true, wasFailing: false, failedDays: 3 }])).toBeNull();
  });
});
