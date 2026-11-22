import { it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

const ENV = ["VERCEL", "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL", "PENNY_DATA_DIR"] as const;
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of ENV)
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  vi.resetModules();
});

async function onVercel() {
  process.env.VERCEL = "1";
  process.env.VERCEL_URL = "penny-abc123.vercel.app";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "penny-demo.vercel.app";
  delete process.env.PENNY_DATA_DIR;
  vi.resetModules();
  return {
    mode: await import("@/server/demo/mode"),
    hosts: await import("@/lib/host-guard"),
    dir: await import("@/server/lib/data-dir"),
    proxy: (await import("@/proxy")).proxy,
  };
}

it("on Vercel the app is always the demo, in /tmp, and answers on any name Vercel gives it", async () => {
  const { mode, hosts, dir } = await onVercel();
  expect(mode.isDemoMode({ VERCEL: "1" })).toBe(true);
  expect(dir.dataDir()).toBe("/tmp/penny-demo");
  expect(hosts.isAllowedHost("penny-demo.vercel.app")).toBe(true);
  expect(hosts.isAllowedHost("penny-abc123.vercel.app")).toBe(true);
  expect(hosts.isAllowedHost("turbo-canyon-abc.tmp.now")).toBe(true);
});

it("off Vercel nothing changes", async () => {
  delete process.env.VERCEL;
  vi.resetModules();
  const mode = await import("@/server/demo/mode");
  const hosts = await import("@/lib/host-guard");
  expect(mode.isDemoMode({})).toBe(false);
  expect(hosts.isAllowedHost("penny-demo.vercel.app")).toBe(false);
});

it("the public demo refuses actions that would lock, wipe or take it over, but still reads", async () => {
  const { proxy } = await onVercel();
  const host = "penny-demo.vercel.app";
  const req = (path: string, method: string) =>
    proxy(
      new NextRequest(`https://${host}${path}`, {
        method,
        headers: { host, origin: `https://${host}`, "sec-fetch-site": "same-origin" },
      }),
    );
  for (const [path, method] of [
    ["/api/lock", "POST"],
    ["/api/data/wipe", "POST"],
    ["/api/data/transactions", "DELETE"],
    ["/api/backup/restore", "POST"],
    ["/api/profiles", "POST"],
    ["/api/access", "POST"],
  ])
    expect(req(path, method).status, `${method} ${path}`).toBe(403);
  expect(req("/api/summary", "GET").status).toBe(200);
  expect(req("/api/transactions/manual", "POST").status).toBe(200); // playing with the demo is fine
});
