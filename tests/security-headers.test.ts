import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

// The browser-facing security policy is code (next.config.ts), so it gets a test:
// a header quietly removed during a refactor fails here instead of in an audit.

type Header = { key: string; value: string };

const headersFor = async (source: string): Promise<Record<string, string>> => {
  const rules = (await nextConfig.headers?.()) ?? [];
  const rule = rules.find((r) => r.source === source);
  expect(rule, `no header rule for ${source}`).toBeTruthy();
  return Object.fromEntries((rule!.headers as Header[]).map((h) => [h.key, h.value]));
};

describe("security headers", () => {
  it("locks the app down for every path", async () => {
    const h = await headersFor("/:path*");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("no-referrer");
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(h["Cross-Origin-Resource-Policy"]).toBe("same-origin");
    expect(h["X-DNS-Prefetch-Control"]).toBe("off");

    const permissions = h["Permissions-Policy"];
    for (const feature of ["camera=()", "microphone=()", "geolocation=()", "payment=()"]) {
      expect(permissions, feature).toContain(feature);
    }
  });

  it("keeps a strict CSP, with no eval outside development", async () => {
    const csp = (await headersFor("/:path*"))["Content-Security-Policy"];
    for (const directive of [
      "default-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(csp, directive).toContain(directive);
    }
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("http:");
    expect(csp).not.toContain("https:");
  });

  it("never caches the service worker, so an update ships immediately", async () => {
    expect((await headersFor("/sw.js"))["Cache-Control"]).toContain("no-cache");
  });
});
