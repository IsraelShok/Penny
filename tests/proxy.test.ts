import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { MCP_READ_PATHS, proxy } from "@/proxy";
import { getOrCreateMcpToken, mcpTokenPath } from "@/server/lib/mcp-token";
import { lockFilePath } from "@/server/lib/encryption";

// Nothing reads the data folder at import time, so this is in place before the first request.
process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-proxy-"));

const req = (path: string, method = "GET", headers: Record<string, string> = {}) =>
  new NextRequest(`http://127.0.0.1:3000${path}`, {
    method,
    headers: { host: "127.0.0.1:3000", ...headers },
  });

describe("proxy", () => {
  it("rejects an unexpected Host (DNS rebinding)", () => {
    expect(proxy(req("/", "GET", { host: "evil.example" })).status).toBe(403);
  });

  it("rejects cross-site API calls, even GETs", () => {
    expect(proxy(req("/api/summary", "GET", { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(proxy(req("/api/summary", "GET", { "sec-fetch-site": "same-site" })).status).toBe(403);
  });

  it("lets same-origin reads through", () => {
    expect(proxy(req("/api/summary", "GET", { "sec-fetch-site": "same-origin" })).status).toBe(200);
  });

  it("requires a same-origin Origin on writes", () => {
    expect(proxy(req("/api/sync", "POST")).status).toBe(403);
    expect(proxy(req("/api/sync", "POST", { origin: "http://evil.example" })).status).toBe(403);
    expect(proxy(req("/api/sync", "POST", { origin: "null" })).status).toBe(403);
    expect(proxy(req("/api/sync", "POST", { origin: "http://127.0.0.1:3000" })).status).toBe(200);
  });
});

describe("proxy: MCP token with the app lock on", () => {
  const withToken = (token: string, extra: Record<string, string> = {}) => ({
    "x-penny-mcp-token": token,
    ...extra,
  });

  // The gate only asks whether the lock file exists.
  beforeAll(() => fs.writeFileSync(lockFilePath(), "{}"));
  afterAll(() => fs.rmSync(lockFilePath(), { force: true }));

  it("refuses a read without a token, and leaves the token file for the MCP server to find", () => {
    fs.rmSync(mcpTokenPath(), { force: true });
    expect(proxy(req("/api/summary")).status).toBe(401);
    expect(fs.readFileSync(mcpTokenPath(), "utf8")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("lets a valid token read the allowlisted routes, without starting a session", () => {
    const token = getOrCreateMcpToken();
    for (const p of MCP_READ_PATHS) {
      const res = proxy(req(p, "GET", withToken(token)));
      expect(res.status, p).toBe(200);
      expect(res.headers.get("set-cookie")).toBeNull();
    }
    expect(proxy(req("/api/transactions?limit=5", "GET", withToken(token))).status).toBe(200);
  });

  it("opens nothing else: other routes, sub-paths, pages and every write stay locked", () => {
    const token = getOrCreateMcpToken();
    for (const p of [
      "/api/integrations",
      "/api/backup",
      "/api/data/export",
      "/api/settings",
      "/api/transactions/1",
      "/api/summary/",
    ])
      expect(proxy(req(p, "GET", withToken(token))).status, p).toBe(401);
    expect(proxy(req("/", "GET", withToken(token))).status).toBe(307);
    const sameOrigin = { origin: "http://127.0.0.1:3000" };
    for (const method of ["POST", "PUT", "PATCH", "DELETE"])
      expect(proxy(req("/api/summary", method, withToken(token, sameOrigin))).status, method).toBe(
        401,
      );
  });

  it("refuses a wrong token", () => {
    const token = getOrCreateMcpToken();
    const flipped = (token[0] === "0" ? "1" : "0") + token.slice(1);
    for (const bad of [flipped, token.slice(1), `${token}0`, "", "x"])
      expect(proxy(req("/api/summary", "GET", withToken(bad))).status).toBe(401);
  });

  it("still checks the Host and the fetch site of a request that carries the token", () => {
    const token = getOrCreateMcpToken();
    expect(
      proxy(req("/api/summary", "GET", withToken(token, { host: "evil.example" }))).status,
    ).toBe(403);
    expect(
      proxy(req("/api/summary", "GET", withToken(token, { "sec-fetch-site": "cross-site" })))
        .status,
    ).toBe(403);
  });
});
