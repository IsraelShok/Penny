import { describe, it, expect, vi, afterAll } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";

vi.mock("@/server/sync/scheduler", () => ({ reschedule: () => undefined }));

// legacyKeyPath() is <cwd>/data/.encryption-key: point cwd at a temp folder standing in for a developer's checkout.
const fakeCwd = fs.mkdtempSync(path.join(os.tmpdir(), "penny-cwd-"));
const legacy = path.join(fakeCwd, "data", ".encryption-key");
fs.mkdirSync(path.dirname(legacy));
const cwd = vi.spyOn(process, "cwd").mockReturnValue(fakeCwd);
afterAll(() => cwd.mockRestore());

process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-legacy-"));
globalThis.__pennyDataKey = undefined;

const OTHER = "cd".repeat(32);
const post = () =>
  new Request("http://127.0.0.1:3000/api/data/wipe", {
    method: "POST",
    body: JSON.stringify({ confirm: "delete" }),
  });

describe("the legacy ./data key", () => {
  it("survives a wipe when it is another install's key, and goes when it is ours", async () => {
    const enc = await import("@/server/lib/encryption");
    const { POST } = await import("@/app/api/data/wipe/route");
    enc.encrypt("x");
    fs.writeFileSync(legacy, OTHER);
    expect((await POST(post())).status).toBe(200);
    expect(fs.readFileSync(legacy, "utf8")).toBe(OTHER);

    enc.encrypt("x");
    fs.writeFileSync(legacy, enc.getKey().toString("hex"));
    expect((await POST(post())).status).toBe(200);
    expect(fs.existsSync(legacy)).toBe(false);
  });

  it("survives turning the lock on when it is another install's key, and goes when it is ours", async () => {
    const enc = await import("@/server/lib/encryption");
    const lock = await import("@/server/lib/app-lock");
    enc.setKeyInMemory(undefined);
    enc.getKey();
    fs.writeFileSync(legacy, OTHER);
    await lock.enableLock("correct horse", 15);
    expect(fs.readFileSync(legacy, "utf8")).toBe(OTHER);

    await lock.disableLock("correct horse");
    fs.writeFileSync(legacy, enc.getKey().toString("hex"));
    await lock.enableLock("correct horse", 15);
    expect(fs.existsSync(legacy)).toBe(false);
  });
});
