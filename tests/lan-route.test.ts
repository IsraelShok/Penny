import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let dataDir: string;

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-lan-"));
  process.env.PENNY_DATA_DIR = dataDir;
  vi.resetModules();
  globalThis.__pennyDataKey = undefined;
});

const post = (body: unknown) =>
  new Request("http://127.0.0.1/api/lan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const get = () => new Request("http://127.0.0.1/api/lan");

describe("phone access", () => {
  it("refuses to turn on without the app lock, then reports plain-HTTP URLs", async () => {
    const lan = await import("@/app/api/lan/route");
    const lock = await import("@/server/lib/app-lock");

    const first = (await (await lan.GET(get())).json()) as {
      enabled: boolean;
      lockEnabled: boolean;
      urls: string[];
    };
    expect(first.enabled).toBe(false);
    expect(first.lockEnabled).toBe(false);
    expect(first.urls.every((u) => u.startsWith("http://"))).toBe(true);

    const denied = await lan.POST(post({ enabled: true }));
    expect(denied.status).toBe(409);
    expect(((await denied.json()) as { error: string }).error).toBe("lock_required");
    expect(fs.existsSync(path.join(dataDir, "lan-access.json"))).toBe(false);

    await lock.enableLock("12345678", 15);
    expect((await lan.POST(post({ enabled: true }))).status).toBe(200);
    expect(fs.existsSync(path.join(dataDir, "lan-access.json"))).toBe(true);

    // The flag is what the launchers read before starting the server.
    const on = (await (await lan.GET(get())).json()) as {
      enabled: boolean;
      lockEnabled: boolean;
      urls: string[];
    };
    expect(on.enabled).toBe(true);
    expect(on.lockEnabled).toBe(true);
    expect(on.urls.every((u) => u.startsWith("http://"))).toBe(true);

    expect((await lan.POST(post({ enabled: false }))).status).toBe(200);
    expect(fs.existsSync(path.join(dataDir, "lan-access.json"))).toBe(false);
  });
});
