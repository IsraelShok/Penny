import { describe, it, expect } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "penny-autobk-route-"));
process.env.PENNY_DATA_DIR = path.join(root, "data");
globalThis.__pennyDataKey = undefined;

const patch = (body: unknown) =>
  new Request("http://127.0.0.1:3000/api/backup/auto", {
    method: "PATCH",
    body: JSON.stringify(body),
  });

describe("automatic backup settings with the app lock on", () => {
  it("ask for the lock passphrase to set the backup passphrase or folder, not to toggle", async () => {
    const lock = await import("@/server/lib/app-lock");
    const { PATCH } = await import("@/app/api/backup/auto/route");
    await lock.enableLock("lock secret", 15);
    const dir = path.join(root, "drive");

    expect((await PATCH(patch({ enabled: false }))).status).toBe(200);
    expect(
      (await PATCH(patch({ passphrase: "correct horse battery", secret: "lock secret" }))).status,
    ).toBe(200);
    expect((await PATCH(patch({ dir, secret: "lock secret" }))).status).toBe(200);
    expect((await PATCH(patch({ passphrase: "attacker passphrase" }))).status).toBe(401);
    lock.succeeded();
    expect((await PATCH(patch({ dir: path.join(root, "elsewhere") }))).status).toBe(401);
  });
});
