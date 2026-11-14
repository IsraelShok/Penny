import { describe, it, expect, beforeAll } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { AVATAR_ART, avatarArtId, parseAvatar, profileName } from "@/lib/profile-avatar";

type Q = typeof import("@/server/db/queries/workspaces");
let q: Q;
let pq: typeof import("@/server/db/queries/profiles");

beforeAll(async () => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-profiles-"));
  (await import("@/server/db/index")).getDb();
  q = await import("@/server/db/queries/workspaces");
  pq = await import("@/server/db/queries/profiles");
});

describe("parseAvatar", () => {
  it("accepts a short emoji and a palette colour", () => {
    expect(parseAvatar({ avatarEmoji: "🦊", avatarColor: "#3D2FD3" })).toEqual({ avatarEmoji: "🦊", avatarColor: "#3d2fd3" });
  });
  it("leaves absent fields untouched and clears null", () => {
    expect(parseAvatar({ name: "x" })).toEqual({});
    expect(parseAvatar({ avatarEmoji: null, avatarColor: "" })).toEqual({ avatarEmoji: null, avatarColor: null });
  });
  it("rejects long emoji and off-palette colours", () => {
    expect(parseAvatar({ avatarEmoji: "123456789" })).toHaveProperty("error");
    expect(parseAvatar({ avatarColor: "#ff0000" })).toHaveProperty("error");
    expect(parseAvatar({ avatarEmoji: 5 })).toHaveProperty("error");
  });
});

describe("illustrated avatars", () => {
  it("fit the stored field and round-trip", () => {
    for (const id of AVATAR_ART) {
      expect(parseAvatar({ avatarEmoji: `@${id}` })).toEqual({ avatarEmoji: `@${id}` });
      expect(avatarArtId(`@${id}`)).toBe(id);
    }
    expect(avatarArtId("🦊")).toBeNull();
    expect(avatarArtId("@nope")).toBeNull();
  });
  it("localizes the seeded Default profile only", () => {
    expect(profileName("Default", "אני")).toBe("אני");
    expect(profileName("Dana", "אני")).toBe("Dana");
  });
});

describe("profiles share the household", () => {
  it("creates, renames and changes avatar without touching the workspace", () => {
    const before = q.listWorkspaces().length;
    const p = pq.createProfile("Dana", { avatarEmoji: "@panda" });
    expect(p).toMatchObject({ name: "Dana", avatarEmoji: "@panda", workspaceId: pq.householdId() });
    expect(pq.updateProfile(p.id, "Dani", { avatarEmoji: "@owl" })).toMatchObject({ name: "Dani", avatarEmoji: "@owl" });
    expect(pq.updateProfile(p.id, "Dani")).toMatchObject({ avatarEmoji: "@owl" });
    expect(() => pq.createProfile("  ")).toThrow();
    expect(q.listWorkspaces().length).toBe(before);
  });
  it("deletes a profile and its prefs only; never the last profile", async () => {
    const db = (await import("@/server/db/index")).getDb();
    const ws = pq.householdId();
    db.prepare("INSERT INTO excluded_merchants (workspace_id, provider, merchant_key) VALUES (?, 'max', 'shop')").run(ws);
    const p = pq.createProfile("Temp");
    db.prepare("INSERT INTO synced_preferences (workspace_id, profile, key, value) VALUES (?, ?, 'studio', '{}')").run(ws, `p${p.id}`);
    pq.deleteProfile(p.id);
    expect(pq.getProfile(p.id)).toBeNull();
    expect(db.prepare("SELECT COUNT(*) AS n FROM synced_preferences WHERE profile = ?").get(`p${p.id}`)).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM excluded_merchants WHERE workspace_id = ?").get(ws)).toEqual({ n: 1 });
    for (const x of pq.listProfiles().slice(1)) pq.deleteProfile(x.id);
    expect(() => pq.deleteProfile(pq.listProfiles()[0].id)).toThrow();
    expect(q.getWorkspace(ws)).not.toBeNull();
  });
});
