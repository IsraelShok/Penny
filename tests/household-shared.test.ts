import { describe, it, expect, beforeAll } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";

let pq: typeof import("@/server/db/queries/profiles");
let plan: typeof import("@/app/api/plan/route");
let settings: typeof import("@/app/api/settings/route");
let prefs: typeof import("@/app/api/preferences/route");
let a: number, b: number;

beforeAll(async () => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-household-"));
  (await import("@/server/db/index")).getDb();
  pq = await import("@/server/db/queries/profiles");
  plan = await import("@/app/api/plan/route");
  settings = await import("@/app/api/settings/route");
  prefs = await import("@/app/api/preferences/route");
  a = pq.listProfiles()[0].id;
  b = pq.createProfile("Partner").id;
});

const req = (profile: number, url: string, body?: unknown) =>
  new Request(`http://x/api/${url}`, { method: body ? "PUT" : "GET", headers: { "x-profile-id": String(profile), "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

describe("profiles share the household completely", () => {
  it("one profile edits the plan; the other sees it, but view prefs stay per profile", async () => {
    const before = (await (await plan.GET(req(a, "plan"))).json()).plan;
    const r = await plan.PUT(req(a, "plan", { plan: { ...before, monthStartDay: 10, emergencyMonths: 3, simpleMode: true } }));
    expect(r.status).toBe(200);
    const seenByB = (await (await plan.GET(req(b, "plan"))).json()).plan;
    expect(seenByB).toMatchObject({ monthStartDay: 10, emergencyMonths: 3, simpleMode: false });
    expect((await (await plan.GET(req(a, "plan"))).json()).plan.simpleMode).toBe(true);
  });

  it("settings edited by one profile are read by the other", async () => {
    const r = await settings.PUT(req(a, "settings", { paydayDay: 15, monthlyTarget: 12000 }));
    expect(r.status).toBe(200);
    expect((await (await settings.GET(req(b, "settings"))).json())).toMatchObject({ paydayDay: 15, monthlyTarget: 12000 });
  });

  it("onboarding skips are household; the look is per profile", async () => {
    expect((await prefs.PUT(req(a, "preferences", { key: "activation", value: ["bank"], revision: 0 }))).status).toBe(200);
    expect((await (await prefs.GET(req(b, "preferences?key=activation"))).json()).value).toEqual(["bank"]);
    expect((await prefs.PUT(req(a, "preferences", { key: "studio", value: { theme: "dark" }, revision: 0 }))).status).toBe(200);
    expect((await (await prefs.GET(req(b, "preferences?key=studio"))).json()).value).toBeNull();
  });
});

describe("047 household preferences migration", () => {
  it("copies the main profile's onboarding skips to the household row, keeping the per-profile rows", async () => {
    const db = (await import("@/server/db/index")).getDb(), ws = pq.householdId();
    db.prepare("DELETE FROM synced_preferences WHERE key = 'activation'").run();
    const put = db.prepare("INSERT INTO synced_preferences (workspace_id, profile, key, value) VALUES (?, ?, 'activation', ?)");
    put.run(ws, `p${b}`, '["b"]');
    put.run(ws, `p${a}`, '["a"]');
    db.exec(fs.readFileSync(path.join(process.cwd(), "src/server/db/migrations/047_household_preferences.sql"), "utf-8"));
    expect(db.prepare("SELECT value FROM synced_preferences WHERE profile = 'household' AND key = 'activation'").get()).toEqual({ value: '["a"]' });
    expect(db.prepare("SELECT COUNT(*) AS n FROM synced_preferences WHERE key = 'activation'").get()).toEqual({ n: 3 });
  });
});
