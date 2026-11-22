import { describe, it, expect, beforeAll } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { goalReachMonth } from "@/lib/plan";

let plan: typeof import("@/app/api/plan/route");
beforeAll(async () => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-goals-"));
  plan = await import("@/app/api/plan/route");
});
const post = (item: Record<string, unknown>) =>
  plan.POST(
    new Request("http://x/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "goal", item }),
    }),
  );

describe("goalReachMonth", () => {
  it("counts whole months of saving from now", () => {
    expect(goalReachMonth(10_000, 1_000, 1_000, new Date(2026, 10, 14))).toBe("2027-08");
    expect(goalReachMonth(10_000, 0, 0, new Date(2026, 10, 14))).toBeNull();
  });
});

describe("custom goals API", () => {
  it("saves icon, color and monthly; derives the month when there is no date", async () => {
    expect(
      (
        await post({
          name: "Car",
          targetAmount: 12_000,
          savedAmount: 0,
          monthly: 1_000,
          icon: "🚗",
          color: "green",
          dated: false,
        })
      ).status,
    ).toBe(200);
    const goal = (await (await plan.GET(new Request("http://x/api/plan"))).json()).goals.find(
      (g: { name: string }) => g.name === "Car",
    );
    expect(goal).toMatchObject({ icon: "🚗", color: "green", monthly: 1_000, dated: false });
    expect(goal.targetDate).toMatch(/^\d{4}-\d{2}$/);
  });
  it("rejects a goal with neither a date nor a monthly amount, a bad color or a negative monthly", async () => {
    expect((await post({ name: "X", targetAmount: 100 })).status).toBe(400);
    expect(
      (await post({ name: "X", targetAmount: 100, targetDate: "2030-01", color: "neon" })).status,
    ).toBe(400);
    expect(
      (await post({ name: "X", targetAmount: 100, targetDate: "2030-01", monthly: -5 })).status,
    ).toBe(400);
  });
});
