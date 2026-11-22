import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

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
