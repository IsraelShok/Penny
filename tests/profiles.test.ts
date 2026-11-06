import { describe, it, expect, beforeAll } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { parseAvatar } from "@/lib/profile-avatar";

type Q = typeof import("@/server/db/queries/workspaces");
let q: Q;

beforeAll(async () => {
  process.env.SPENT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "spent-profiles-"));
  (await import("@/server/db/index")).getDb();
  q = await import("@/server/db/queries/workspaces");
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

describe("workspace avatar columns", () => {
  it("stores avatar on create and update; refuses deleting the last profile", () => {
    const ws = q.createWorkspace("Dana", { avatarEmoji: "🐼", avatarColor: "#4caf7a" });
    expect(ws).toMatchObject({ avatarEmoji: "🐼", avatarColor: "#4caf7a" });
    expect(q.updateWorkspace(ws.id, "Dana", { avatarEmoji: null })).toMatchObject({ avatarEmoji: null, avatarColor: "#4caf7a" });
    for (const w of q.listWorkspaces()) if (w.id !== ws.id) q.deleteWorkspace(w.id);
    expect(() => q.deleteWorkspace(ws.id)).toThrow();
  });
});
