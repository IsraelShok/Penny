import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// Whole flow in one test on purpose: bootstrap, then login, then the workspace gate, all
// against the same throwaway database.
process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-access-"));

const URL_BASE = "http://127.0.0.1/api/access";
const cookieOf = (res: Response): string => {
  const raw = res.headers.get("set-cookie") ?? "";
  const match = raw.match(/penny-user=([^;]+)/);
  expect(match, `session cookie in ${raw}`).not.toBeNull();
  return `penny-user=${match![1]}`;
};
const post = (body: unknown, cookie?: string) =>
  new Request(URL_BASE, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
const get = (cookie?: string) => new Request(URL_BASE, { headers: cookie ? { cookie } : {} });

describe("access: bootstrap, login and roles", () => {
  it("bootstraps the owner, signs in, and gates every non-admin action", async () => {
    const route = await import("@/app/api/access/route");
    const { getDb } = await import("@/server/db");
    const { proxy } = await import("@/proxy");

    // Nothing configured yet: the screen can render, no session.
    const before = (await (await route.GET(get())).json()) as { enabled: boolean; user: unknown };
    expect(before.enabled).toBe(false);
    expect(before.user).toBeNull();

    const boot = await route.POST(
      post({ action: "bootstrap", name: "Owner", username: "owner", password: "a-long-password" }),
    );
    expect(boot.status).toBe(200);
    const setCookie = boot.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=strict");
    const owner = cookieOf(boot);
    // Plain HTTP here, so the cookie must not claim to be Secure.
    expect(setCookie).not.toContain("Secure");

    // Bootstrap is one-shot.
    expect(
      (
        await route.POST(
          post({ action: "bootstrap", name: "X", username: "other", password: "another-pass" }),
        )
      ).status,
    ).toBe(409);

    const state = (await (await route.GET(get(owner))).json()) as {
      enabled: boolean;
      user: { isAdmin: boolean };
      users: unknown[];
    };
    expect(state.enabled).toBe(true);
    expect(state.user.isAdmin).toBe(true);
    expect(state.users).toHaveLength(1);

    // Wrong and right credentials.
    expect(
      (await route.POST(post({ action: "login", username: "owner", password: "wrong-password" })))
        .status,
    ).toBe(401);
    const wrongShape = await route.POST(
      post({ action: "login", username: "owner", password: 12345 }),
    );
    expect(wrongShape.status).toBe(401);
    const login = await route.POST(
      post({ action: "login", username: "owner", password: "a-long-password" }),
    );
    expect(login.status).toBe(200);
    expect(cookieOf(login)).toContain("penny-user=");

    // The owner creates a second, non-admin user.
    const weak = await route.POST(
      post({ action: "create-user", name: "Kid", username: "kid", password: "short" }, owner),
    );
    expect(weak.status).toBe(400);
    const created = await route.POST(
      post(
        { action: "create-user", name: "Kid", username: "kid", password: "another-long-password" },
        owner,
      ),
    );
    expect(created.status).toBe(200);
    const memberId = ((await created.json()) as { id: number }).id;
    const member = cookieOf(
      await route.POST(
        post({ action: "login", username: "kid", password: "another-long-password" }),
      ),
    );

    // A member gets no admin lists and cannot create users or touch other workspaces.
    const memberState = (await (await route.GET(get(member))).json()) as {
      user: { isAdmin: boolean };
      users: unknown[];
      members: unknown[];
      audit: unknown[];
    };
    expect(memberState.user.isAdmin).toBe(false);
    expect(memberState.users).toEqual([]);
    expect(memberState.members).toEqual([]);
    expect(memberState.audit).toEqual([]);
    expect(
      (
        await route.POST(
          post(
            {
              action: "create-user",
              name: "N",
              username: "nope",
              password: "another-long-password",
            },
            member,
          ),
        )
      ).status,
    ).toBe(403);

    // Membership validation and assignment.
    expect(
      (
        await route.POST(
          post({ action: "membership", userId: memberId, workspaceId: 1, role: "owner" }, owner),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await route.POST(
          post({ action: "membership", userId: memberId, workspaceId: 999, role: "viewer" }, owner),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await route.POST(
          post({ action: "membership", userId: memberId, workspaceId: 1, role: "viewer" }, owner),
        )
      ).status,
    ).toBe(200);

    const db = getDb();
    const other = Number(
      db.prepare("INSERT INTO workspaces (name, slug) VALUES ('Other', 'other')").run()
        .lastInsertRowid,
    );

    // The proxy is the workspace boundary: header spoofing for a foreign workspace is 403.
    const asMember = (pathname: string, method: string, workspaceId?: number) =>
      proxy(
        new NextRequest(`http://127.0.0.1${pathname}`, {
          method,
          headers: {
            host: "127.0.0.1",
            cookie: member,
            ...(workspaceId === undefined ? {} : { "x-workspace-id": String(workspaceId) }),
          },
        }),
      );
    expect(asMember("/api/home", "GET", 1).status).toBe(200);
    expect(asMember("/api/home", "GET", other).status).toBe(403);
    expect(asMember("/api/home", "GET").status).toBe(200); // falls back to their one workspace
    expect(asMember("/api/budgets", "POST", 1).status).toBe(403); // viewers are read-only

    // Sessions can be revoked, and the revoked cookie stops working.
    expect(
      (await route.POST(post({ action: "revoke-sessions", userId: memberId }, owner))).status,
    ).toBe(200);
    expect((await route.GET(get(member))).status).toBe(200);
    expect(((await (await route.GET(get(member))).json()) as { user: unknown }).user).toBeNull();
  });
});
