import { describe, it, expect, beforeEach, vi } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";

async function freshEncryption() {
  vi.resetModules();
  return import("@/server/lib/encryption");
}

describe("encryption key location", () => {
  let dataDir: string;
  let cwd: string;

  beforeEach(() => {
    globalThis.__pennyDataKey = undefined;
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "penny-cwd-"));
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-data-"));
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
    process.env.PENNY_DATA_DIR = dataDir;
  });

  it("keeps the key next to the database in PENNY_DATA_DIR", async () => {
    const { encrypt, decrypt } = await freshEncryption();
    const sealed = encrypt("secret");
    expect(fs.existsSync(path.join(dataDir, ".encryption-key"))).toBe(true);
    expect(fs.existsSync(path.join(cwd, "data", ".encryption-key"))).toBe(false);
    expect(decrypt(sealed)).toBe("secret");
  });

  it.skipIf(process.platform !== "win32")(
    "on Windows, leaves the key file readable by the current user alone",
    async () => {
      const { execFileSync } = await import("child_process");
      const { encrypt, keyPath } = await freshEncryption();
      encrypt("secret");
      const icacls = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "icacls.exe");
      // One line per ACL entry, each starting with the file path or indentation, then "NAME:(rights)".
      const entries = execFileSync(icacls, [keyPath()], { encoding: "utf8" })
        .replace(keyPath(), "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => /:\(/.test(l));
      expect(entries).toHaveLength(1);
      expect(entries[0].toLowerCase()).toContain(`\\${os.userInfo().username.toLowerCase()}:(f)`);
    },
  );

  it("adopts a key left in ./data by an older version, so saved credentials still decrypt", async () => {
    const legacyKey = "ab".repeat(32);
    fs.mkdirSync(path.join(cwd, "data"));
    fs.writeFileSync(path.join(cwd, "data", ".encryption-key"), legacyKey, { mode: 0o600 });
    const { encrypt } = await freshEncryption();
    encrypt("x");
    expect(fs.readFileSync(path.join(dataDir, ".encryption-key"), "utf8").trim()).toBe(legacyKey);
  });
});
