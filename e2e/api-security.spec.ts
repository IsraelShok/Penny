import { expect, test } from "@playwright/test";

// Fullstack security checks against the real production server: the headers the browser
// actually receives, the proxy's CSRF and cross-site rules, and the contract that a bad
// request is a 4xx rather than a 500. No state is changed, so these can run in any order.
const ORIGIN = "http://127.0.0.1:3100";

test.describe("security over real HTTP", () => {
  test("ships the hardened headers on pages and on API responses", async ({ request }) => {
    for (const path of ["/", "/api/health"]) {
      const res = await request.get(path, { headers: { origin: ORIGIN } });
      expect(res.status(), path).toBe(200);
      const headers = res.headers();
      expect(headers["x-frame-options"], path).toBe("DENY");
      expect(headers["x-content-type-options"], path).toBe("nosniff");
      expect(headers["referrer-policy"], path).toBe("no-referrer");
      expect(headers["cross-origin-opener-policy"], path).toBe("same-origin");
      const csp = headers["content-security-policy"];
      expect(csp, path).toContain("default-src 'self'");
      expect(csp, path).toContain("frame-ancestors 'none'");
      expect(csp, path).not.toContain("unsafe-eval");
    }
  });

  test("health answers with a tiny, path-free body", async ({ request }) => {
    const body = (await (await request.get("/api/health")).json()) as Record<string, unknown>;
    expect(body).toHaveProperty("ok");
    expect(body).toHaveProperty("version");
    expect(typeof body.ok).toBe("boolean");
    expect(JSON.stringify(body)).not.toMatch(/[A-Za-z]:\\|\/home\/|\/Users\//);
  });

  test("blocks a cross-site read", async ({ request }) => {
    const res = await request.get("/api/summary", {
      headers: { "sec-fetch-site": "cross-site", origin: "https://evil.example" },
    });
    expect(res.status()).toBe(403);
  });

  test("blocks a write without an Origin, and one from another site", async ({ request }) => {
    const noOrigin = await request.post("/api/budgets", { data: { categoryId: 1, amount: 10 } });
    expect(noOrigin.status()).toBe(403);
    const evil = await request.post("/api/budgets", {
      headers: { origin: "https://evil.example" },
      data: { categoryId: 1, amount: 10 },
    });
    expect(evil.status()).toBe(403);
  });

  test("rejects a rebound Host header", async ({ request }) => {
    const res = await request.get(`${ORIGIN}/api/health`, {
      headers: { host: "attacker.example" },
    });
    expect(res.status()).toBe(403);
  });

  test("turns malformed input into a 4xx, never a 500", async ({ request }) => {
    for (const path of [
      "/api/budgets",
      "/api/categories",
      "/api/transactions/manual",
      "/api/settings",
    ]) {
      const res = await request.post(path, {
        headers: { origin: ORIGIN, "content-type": "application/json" },
        data: "not json",
      });
      expect(res.status(), path).toBeGreaterThanOrEqual(400);
      expect(res.status(), path).toBeLessThan(500);
    }
  });

  test("an unknown API path is a clean 404", async ({ request }) => {
    const res = await request.get("/api/does-not-exist", { headers: { origin: ORIGIN } });
    expect(res.status()).toBe(404);
  });

  test("serves the service worker uncached", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("no-cache");
  });
});
