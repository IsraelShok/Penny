import { beforeEach, afterEach, it, expect, vi } from "vitest";
import Database from "better-sqlite3";
const holder = vi.hoisted(() => ({ db: null as unknown as Database.Database }));
vi.mock("@/server/db", () => ({ getDb: () => holder.db }));
import { runMigrations } from "@/server/db/migrate";
import {
  createUser,
  loginUser,
  currentUser,
  membership,
  allowedMemberRoute,
  newSession,
  USER_COOKIE,
} from "@/server/lib/user-access";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { GET as getPreference, PUT as putPreference } from "@/app/api/preferences/route";
import { proxy } from "@/proxy";
import { NextRequest } from "next/server";
beforeEach(() => {
  holder.db = new Database(":memory:");
  runMigrations(holder.db);
  holder.db.pragma("foreign_keys=ON");
});
afterEach(() => holder.db.close());
const req = (token: string, ws = 1) =>
  new Request("http://localhost/api/control", {
    headers: { cookie: `${USER_COOKIE}=${token}`, "x-workspace-id": String(ws) },
  });
it("hashes credentials, authenticates sessions and enforces workspace isolation", () => {
  createUser("Owner", "owner", "long-passphrase-123", true);
  const id = createUser("Member", "member", "another-passphrase-123");
  const token = loginUser("member", "another-passphrase-123");
  const user = currentUser(req(token))!;
  expect(user.id).toBe(id);
  expect(membership(user, 1)).toBeNull();
  expect(() => getWorkspaceIdFromRequest(req(token))).toThrow();
  holder.db.prepare("INSERT INTO workspace_members VALUES (?,1,'viewer')").run(id);
  expect(getWorkspaceIdFromRequest(req(token))).toBe(1);
  expect(() => getWorkspaceIdFromRequest(req(token, 99))).toThrow();
  expect(currentUser(req("forged"))).toBeNull();
  expect(holder.db.prepare("SELECT password_hash FROM app_users WHERE id=?").get(id)).not.toEqual({
    password_hash: "another-passphrase-123",
  });
});
it("viewers cannot mutate financial data and editors cannot reach admin routes", () => {
  expect(allowedMemberRoute("/api/transactions/edit", "POST", "viewer")).toBe(false);
  expect(allowedMemberRoute("/api/transactions/edit", "POST", "editor")).toBe(true);
  expect(allowedMemberRoute("/api/settings", "GET", "editor")).toBe(false);
  expect(allowedMemberRoute("/api/data/wipe", "POST", "editor")).toBe(false);
  expect(allowedMemberRoute("/api/sync", "POST", "editor")).toBe(false);
});
it("protects routes in proxy, including missing credentials and forged workspace headers", () => {
  const id = createUser("Member", "member", "another-passphrase-123");
  holder.db.prepare("INSERT INTO workspace_members VALUES (?,1,'viewer')").run(id);
  const token = newSession(id);
  const make = (path: string, method: string, workspace: string, cookie: string) =>
    new NextRequest(`http://localhost${path}`, {
      method,
      headers: {
        host: "localhost",
        origin: "http://localhost",
        "x-workspace-id": workspace,
        cookie,
      },
    });
  expect(proxy(make("/api/control", "GET", "1", "")).status).toBe(401);
  expect(proxy(make("/api/control", "POST", "1", `${USER_COOKIE}=${token}`)).status).toBe(403);
  expect(proxy(make("/api/control", "GET", "99", `${USER_COOKIE}=${token}`)).status).toBe(403);
  expect(proxy(make("/api/control", "GET", "1", `${USER_COOKIE}=${token}`)).status).toBe(200);
});
it("persists preferences per identity and rejects stale revisions", async () => {
  const owner = createUser("Owner", "owner", "long-passphrase-123", true),
    other = createUser("Other", "other", "another-passphrase-123");
  holder.db.prepare("INSERT INTO workspace_members VALUES (?,1,'viewer')").run(other);
  const a = newSession(owner),
    b = newSession(other);
  const put = (token: string, revision: number) =>
    new Request("http://localhost/api/preferences", {
      method: "PUT",
      headers: {
        cookie: `${USER_COOKIE}=${token}`,
        "x-workspace-id": "1",
        "content-type": "application/json",
      },
      body: JSON.stringify({ key: "studio", value: { theme: "glass" }, revision }),
    });
  expect((await putPreference(put(a, 0))).status).toBe(200);
  expect((await putPreference(put(a, 0))).status).toBe(409);
  const result = await getPreference(
    new Request("http://localhost/api/preferences?key=studio", {
      headers: { cookie: `${USER_COOKIE}=${b}`, "x-workspace-id": "1" },
    }),
  );
  expect(await result.json()).toEqual({ value: null, revision: 0 });
});
