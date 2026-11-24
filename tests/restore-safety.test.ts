import { describe, it, expect, beforeAll, vi, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import os from "os";
import path from "path";
import fs from "fs";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-restore-safety-"));
let backup: typeof import("@/server/lib/portable-backup");
let db: typeof import("@/server/db/index");
let settings: typeof import("@/server/db/queries/settings");

beforeAll(async () => {
  process.env.PENNY_DATA_DIR = dataDir;
  globalThis.__pennyDataKey = undefined;
  db = await import("@/server/db/index");
  settings = await import("@/server/db/queries/settings");
  backup = await import("@/server/lib/portable-backup");
});
afterEach(() => vi.restoreAllMocks());

const PASSPHRASE = "correct horse battery";
const live = () => path.join(dataDir, "penny.db");

describe("restore safety", () => {
  it("restores over a damaged database, which VACUUM INTO refuses to copy", () => {
    settings.setGlobalSetting("safety", "good");
    const { bytes } = backup.createBackup(PASSPHRASE);

    const conn = db.getDb();
    conn.exec("CREATE TABLE junk (v TEXT)");
    const insert = conn.prepare("INSERT INTO junk VALUES (?)");
    for (let i = 0; i < 500; i++) insert.run("x".repeat(200));
    const { rootpage } = conn
      .prepare("SELECT rootpage FROM sqlite_master WHERE name = 'junk'")
      .get() as { rootpage: number };
    const pageSize = conn.pragma("page_size", { simple: true }) as number;
    conn.pragma("wal_checkpoint(TRUNCATE)");
    db.closeDb();
    const fd = fs.openSync(live(), "r+");
    fs.writeSync(fd, Buffer.alloc(pageSize, 0xab), 0, pageSize, (rootpage - 1) * pageSize);
    fs.closeSync(fd);
    expect(() => db.getDb().prepare("VACUUM INTO ?").run(path.join(dataDir, "x.db"))).toThrow(
      /malformed/,
    );

    const result = backup.applyBackup(bytes, PASSPHRASE);
    expect(fs.existsSync(result.preRestoreBackup!)).toBe(true);
    expect(settings.getGlobalSetting("safety")).toBe("good");
  });

  it("keeps the replaced key beside the copy of the replaced database", async () => {
    const enc = await import("@/server/lib/encryption");
    const { bytes } = backup.createBackup(PASSPHRASE);
    const old = "ab".repeat(32);
    fs.writeFileSync(enc.keyPath(), old, { mode: 0o600 });
    enc.setKeyInMemory(undefined);
    const result = backup.applyBackup(bytes, PASSPHRASE);
    expect(fs.readFileSync(`${result.preRestoreBackup}.key`, "utf8")).toBe(old);
    expect(fs.readFileSync(enc.keyPath(), "utf8")).not.toBe(old);
  });

  it("swaps the file in with one rename, and a failed staging write leaves nothing behind", () => {
    settings.setGlobalSetting("safety", "before");
    const { bytes } = backup.createBackup(PASSPHRASE);
    settings.setGlobalSetting("safety", "after");
    const staged = `${live()}.restore-tmp`;

    const rename = vi.spyOn(fs, "renameSync");
    backup.applyBackup(bytes, PASSPHRASE);
    expect(rename).toHaveBeenCalledWith(staged, live());
    expect(settings.getGlobalSetting("safety")).toBe("before");

    const write = fs.writeFileSync;
    vi.spyOn(fs, "writeFileSync").mockImplementation((file, data, opts) => {
      if (file !== staged) return write(file, data, opts);
      write(file, "half"); // a disk that fills up part way through
      throw Object.assign(new Error("ENOSPC"), { code: "ENOSPC" });
    });
    expect(() => backup.applyBackup(bytes, PASSPHRASE)).toThrow("ENOSPC");
    expect(fs.existsSync(staged)).toBe(false);
    expect(settings.getGlobalSetting("safety")).toBe("before");
  });

  it("the command-line backup carries documents and refuses while the lock is on", () => {
    const doc = path.join(dataDir, "policies", "1", "policy.pdf");
    fs.mkdirSync(path.dirname(doc), { recursive: true });
    fs.writeFileSync(doc, "policy text");
    db.getDb().pragma("wal_checkpoint(TRUNCATE)");
    const env = { ...process.env, PENNY_DATA_DIR: dataDir, PENNY_BACKUP_PASSPHRASE: PASSPHRASE };
    const script = path.join(process.cwd(), "scripts", "backup.mjs");
    const before = new Set(backup.listBackups().map((b) => b.name));
    execFileSync(process.execPath, [script], { env, stdio: "pipe" });
    const made = backup.listBackups().find((b) => !before.has(b.name))!;
    fs.rmSync(doc);

    backup.applyBackup(fs.readFileSync(path.join(dataDir, "backups", made.name)), PASSPHRASE);
    expect(fs.readFileSync(doc, "utf8")).toBe("policy text");

    fs.writeFileSync(path.join(dataDir, ".app-lock.json"), "{}");
    try {
      execFileSync(process.execPath, [script], { env, stdio: "pipe" });
      expect.unreachable();
    } catch (e) {
      expect(String((e as { stderr: Buffer }).stderr)).toMatch(/Settings -> Backup/);
    } finally {
      fs.rmSync(path.join(dataDir, ".app-lock.json"));
    }
  }, 60_000);
});
