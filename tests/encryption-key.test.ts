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
    "on Windows, the key file is closed to other users of the computer",
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
      // SYSTEM and Administrators may be listed (a CI runner adds them); the broad groups must not be.
      const lower = entries.map((e) => e.toLowerCase());
      const me = `\\${os.userInfo().username.toLowerCase()}:(f)`;
      expect(lower.some((e) => e.includes(me))).toBe(true);
      expect(lower.filter((e) => /everyone|authenticated users|builtin\\users/.test(e))).toEqual(
        [],
      );
      // Nothing inherited from the folder.
      expect(lower.some((e) => e.includes("(i)"))).toBe(false);
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
