import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

beforeAll(() => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-quick-add-"));
  vi.resetModules();
  globalThis.__pennyDataKey = undefined;
});

const quickAdd = (body: unknown, auth?: string) =>
  new Request("http://127.0.0.1/api/quick-add", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  });
const tokens = (method: string, body?: unknown, query = "") =>
  new Request(`http://127.0.0.1/api/device-tokens${query}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("phone quick-add", () => {
  it("needs a live device token, stores only its hash, and stops working once revoked", async () => {
    const route = await import("@/app/api/quick-add/route");
    const tokenRoute = await import("@/app/api/device-tokens/route");
    const { getDb } = await import("@/server/db");

    expect((await route.POST(quickAdd({ amount: 10, description: "קפה" }))).status).toBe(401);
    expect(
      (await route.POST(quickAdd({ amount: 10, description: "קפה" }, "Bearer pdt_guess"))).status,
    ).toBe(401);

    const { id, token } = (await (
      await tokenRoute.POST(tokens("POST", { name: "iPhone" }))
    ).json()) as {
      id: number;
      token: string;
    };
    expect(token).toMatch(/^pdt_[\w-]{43}$/);
    const stored = getDb().prepare("SELECT token_hash FROM device_tokens WHERE id=?").get(id) as {
      token_hash: string;
    };
    expect(stored.token_hash).not.toContain(token);
    const listed = await (await tokenRoute.GET(tokens("GET"))).text();
    expect(listed).not.toContain(token);

    const ok = await route.POST(
      quickAdd({ amount: "42,5", description: "קפה" }, `Bearer ${token}`),
    );
    expect(ok.status).toBe(200);
    const txId = ((await ok.json()) as { id: number }).id;
    expect(
      getDb().prepare("SELECT charged_amount, provider FROM transactions WHERE id=?").get(txId),
    ).toEqual({
      charged_amount: -42.5,
      provider: "cash",
    });
    expect((await route.POST(quickAdd({ amount: -1 }, `Bearer ${token}`))).status).toBe(400);

    await tokenRoute.DELETE(tokens("DELETE", undefined, `?id=${id}`));
    expect(
      (await route.POST(quickAdd({ amount: 10, description: "קפה" }, `Bearer ${token}`))).status,
    ).toBe(401);
  });

  it("lets the proxy pass only token-bearing POSTs, without browser credentials", async () => {
    const { proxy } = await import("@/proxy");
    const req = (method: string, headers: Record<string, string>) =>
      new NextRequest("http://127.0.0.1:3000/api/quick-add", {
        method,
        headers: { host: "127.0.0.1:3000", ...headers },
      });
    expect(proxy(req("POST", {})).status).toBe(401);
    expect(proxy(req("GET", { authorization: "Bearer x" })).status).toBe(401);
    expect(
      proxy(req("POST", { authorization: "Bearer x", "sec-fetch-site": "cross-site" })).status,
    ).toBe(401);
    expect(proxy(req("POST", { authorization: "Bearer x", host: "evil.example" })).status).toBe(
      403,
    );
    const passed = proxy(
      req("POST", { authorization: "Bearer x", "x-workspace-id": "2", cookie: "a=b" }),
    );
    expect(passed.status).toBe(200);
    expect(passed.headers.get("x-middleware-request-authorization")).toBe("Bearer x");
    expect(passed.headers.get("x-middleware-request-x-workspace-id")).toBeNull();
    expect(passed.headers.get("x-middleware-request-cookie")).toBeNull();
    // Other writes keep the same-origin rule.
    expect(
      proxy(
        new NextRequest("http://127.0.0.1:3000/api/transactions/manual", {
          method: "POST",
          headers: { host: "127.0.0.1:3000", authorization: "Bearer x" },
        }),
      ).status,
    ).toBe(403);
  });
});
