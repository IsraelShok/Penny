import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

beforeAll(() => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-bot-sms-"));
  vi.resetModules();
  globalThis.__pennyDataKey = undefined;
});

describe("bot bank texts", () => {
  it("proposes a texted charge and saves it once as a pending manual row", async () => {
    const { smsCard, smsAction } = await import("@/server/bot/sms");
    const { getDb } = await import("@/server/db");
    const { listAllWorkspaceIds } = await import("@/server/lib/workspace-context");
    const ws = listAllWorkspaceIds()[0];

    expect(smsCard("מה המצב?", "2026-11-22")).toBeNull();
    const card = smsCard('בכרטיסך המסתיים ב-1234 אושרה עסקה ב-שופרסל בסך 99.90 ש"ח', "2026-11-22");
    const [save, ignore] = card!.markup.inline_keyboard[0].map((b) => b.callback_data);
    expect(save.length).toBeLessThanOrEqual(64); // Telegram's callback data limit

    expect(smsAction(ws, save)).toContain("נשמר");
    expect(smsAction(ws, save)).toContain("פג תוקף"); // a second tap does not save twice
    expect(smsAction(ws, ignore)).toContain("פג תוקף");
    expect(
      getDb()
        .prepare("SELECT charged_amount, status FROM transactions WHERE dedup_hash LIKE 'sms:%'")
        .all(),
    ).toEqual([{ charged_amount: -99.9, status: "pending" }]);
  });
});
