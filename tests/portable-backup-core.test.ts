import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** The restore paths that must never cost the data in use: rollbacks, the lock, crafted files. */

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-portable-core-"));
let backup: typeof import("@/server/lib/portable-backup");
let settings: typeof import("@/server/db/queries/settings");
let enc: typeof import("@/server/lib/encryption");

beforeAll(async () => {
  process.env.PENNY_DATA_DIR = dataDir;
  globalThis.__pennyDataKey = undefined;
  settings = await import("@/server/db/queries/settings");
  enc = await import("@/server/lib/encryption");
  backup = await import("@/server/lib/portable-backup");
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(enc.lockFilePath(), { force: true });
});

const PASS = "correct horse battery";
type Payload = import("@/server/lib/portable-backup").BackupPayload;
const open = (bytes: Buffer): Payload => backup.readBackup(bytes, PASS);
const seal = (p: unknown) => backup.encryptBackup(Buffer.from(JSON.stringify(p)), PASS);

/** Rewrites the database inside a payload with `edit`. */
function editDatabase(p: Payload, edit: (db: Database.Database) => void): Payload {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-edit-"));
  const file = path.join(dir, "x.db");
  fs.writeFileSync(file, Buffer.from(p.database, "base64"));
  const db = new Database(file);
  edit(db);
  db.close();
  const out = { ...p, database: fs.readFileSync(file).toString("base64") };
  fs.rmSync(dir, { recursive: true, force: true });
  return out;
}

describe("readBackup", () => {
  it("refuses text that decrypts but is not JSON, or JSON of the wrong shape", () => {
    expect(() => open(backup.encryptBackup(Buffer.from("{not json"), PASS))).toThrow("badFile");
    expect(() => open(seal(null))).toThrow("badFile");
    expect(() => open(seal({ format: 2, database: "" }))).toThrow("badFile");
    expect(() => open(seal({ format: 1, database: 42 }))).toThrow("badFile");
  });

  it("refuses a file cut short before its body", () => {
    const full = backup.encryptBackup(Buffer.from("x"), PASS);
    expect(() => backup.decryptBackup(full.subarray(0, 8 + 1 + 16 + 12 + 16), PASS)).toThrow(
      "badFile",
    );
  });
});

describe("isSqlite", () => {
  it("needs the full SQLite header and something after it", () => {
    const header = Buffer.from("SQLite format 3\u0000");
    expect(backup.isSqlite(header)).toBe(false);
    expect(backup.isSqlite(Buffer.concat([header, Buffer.from([1])]))).toBe(true);
    expect(backup.isSqlite(Buffer.from("SQLite format 4\u0000xx"))).toBe(false);
  });
});

describe("backupKey", () => {
  it("is null for a backup without a key", () => {
    expect(backup.backupKey(null)).toBeNull();
    expect(backup.backupKey(undefined)).toBeNull();
    expect(backup.backupKey("")).toBeNull();
  });
});

describe("backup files", () => {
  it("collects documents in nested folders, and nothing outside policies and receipts", () => {
    fs.mkdirSync(path.join(dataDir, "policies", "7", "scans"), { recursive: true });
    fs.writeFileSync(path.join(dataDir, "policies", "7", "scans", "p.pdf"), "pdf");
    fs.mkdirSync(path.join(dataDir, "receipts"), { recursive: true });
    fs.writeFileSync(path.join(dataDir, "receipts", "r.jpg"), "jpg");
    fs.mkdirSync(path.join(dataDir, "other"), { recursive: true });
    fs.writeFileSync(path.join(dataDir, "other", "x.txt"), "x");
    const files = backup.collectDataFiles(dataDir);
    expect(files["policies/7/scans/p.pdf"]).toBe(Buffer.from("pdf").toString("base64"));
    expect(files["receipts/r.jpg"]).toBe(Buffer.from("jpg").toString("base64"));
    expect(Object.keys(files).some((k) => k.startsWith("other"))).toBe(false);
    fs.rmSync(path.join(dataDir, "other"), { recursive: true });
  });

  it("restores only to paths inside those folders", () => {
    expect(backup.restorePathFor(dataDir, "receipts/a.jpg")).toBe(
      path.join(dataDir, "receipts", "a.jpg"),
    );
    for (const bad of [
      "../x",
      "receipts/../../x",
      "receipts//a",
      "./receipts/a",
      "data/x",
      "receipts/.",
    ])
      expect(backup.restorePathFor(dataDir, bad)).toBeNull();
  });

  it("names the file by the minute it was taken", () => {
    expect(backup.backupFileName(new Date("2026-03-04T05:06:59Z"))).toBe(
      "penny-backup-2026-03-04-05-06.pennybak",
    );
  });
});

describe("createBackup", () => {
  it("records the app version and counts the transactions it holds", () => {
    vi.stubEnv("npm_package_version", "9.9.9");
    try {
      const { bytes, counts } = backup.createBackup(PASS);
      expect(open(bytes).appVersion).toBe("9.9.9");
      expect(counts).toEqual(expect.objectContaining({ transactions: expect.any(Number) }));
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("with the lock on and no unwrapped key, backs up the database without a key", () => {
    fs.writeFileSync(enc.lockFilePath(), "{}");
    const key = globalThis.__pennyDataKey;
    globalThis.__pennyDataKey = undefined;
    try {
      expect(open(backup.createBackup(PASS).bytes).encryptionKey).toBeNull();
    } finally {
      globalThis.__pennyDataKey = key;
    }
  });
});

describe("listBackups", () => {
  it("lists only .pennybak files, newest first", () => {
    const dir = path.join(dataDir, "backups");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "old.pennybak"), "a");
    fs.writeFileSync(path.join(dir, "new.pennybak"), "bb");
    fs.writeFileSync(path.join(dir, "note.txt"), "x");
    fs.utimesSync(path.join(dir, "old.pennybak"), new Date("2026-01-01"), new Date("2026-01-01"));
    fs.utimesSync(path.join(dir, "new.pennybak"), new Date("2026-06-01"), new Date("2026-06-01"));
    const list = backup
      .listBackups()
      .filter((b) => ["old.pennybak", "new.pennybak"].includes(b.name));
    expect(list.map((b) => [b.name, b.size])).toEqual([
      ["new.pennybak", 2],
      ["old.pennybak", 1],
    ]);
    expect(backup.listBackups().some((b) => b.name === "note.txt")).toBe(false);
  });

  it("is empty before any backup folder exists", async () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), "penny-nobackups-"));
    vi.stubEnv("PENNY_DATA_DIR", other);
    try {
      expect(backup.listBackups()).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
      process.env.PENNY_DATA_DIR = dataDir;
    }
  });
});

describe("applyBackup", () => {
  it("refuses a SQLite file that is not a Penny database, before touching anything", () => {
    settings.setGlobalSetting("core", "live");
    const p = open(backup.createBackup(PASS).bytes);
    const foreign = editDatabase(p, (db) => db.exec("DROP TABLE transactions"));
    expect(() => backup.applyBackup(seal(foreign), PASS)).toThrow("badFile");
    const junk = { ...p, database: Buffer.from("SQLite format 3\u0000garbage").toString("base64") };
    expect(() => backup.applyBackup(seal(junk), PASS)).toThrow("badFile");
    expect(settings.getGlobalSetting("core")).toBe("live");
  });

  it("with the lock on, refuses a backup carrying a different key and changes nothing", () => {
    settings.setGlobalSetting("core", "locked-live");
    const p = open(backup.createBackup(PASS).bytes);
    const other = { ...p, encryptionKey: Buffer.alloc(32, 3).toString("base64") };
    fs.writeFileSync(enc.lockFilePath(), "{}");
    expect(() => backup.applyBackup(seal(other), PASS)).toThrow("lockOn");
    expect(settings.getGlobalSetting("core")).toBe("locked-live");
  });

  it("with the lock on, restores a backup made with the same key, leaving the key file alone", () => {
    settings.setGlobalSetting("core", "before");
    const { bytes } = backup.createBackup(PASS);
    settings.setGlobalSetting("core", "after");
    fs.writeFileSync(enc.lockFilePath(), "{}");
    const keyBefore = fs.readFileSync(enc.keyPath(), "utf8");
    const r = backup.applyBackup(bytes, PASS);
    expect(settings.getGlobalSetting("core")).toBe("before");
    expect(fs.readFileSync(enc.keyPath(), "utf8")).toBe(keyBefore);
    // The key did not change, so none is kept beside the copy of the replaced database.
    expect(fs.existsSync(`${r.preRestoreBackup}.key`)).toBe(false);
  });

  it("puts the previous database and key back when the restored one will not open", () => {
    settings.setGlobalSetting("core", "keep me");
    const oldKeyHex = fs.readFileSync(enc.keyPath(), "utf8");
    const p = open(backup.createBackup(PASS).bytes);
    // From a newer version: an applied migration this code does not have.
    const future = editDatabase(p, (db) =>
      db.prepare("INSERT INTO _migrations (name) VALUES ('999_from_the_future.sql')").run(),
    );
    future.encryptionKey = Buffer.alloc(32, 5).toString("base64");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => backup.applyBackup(seal(future), PASS)).toThrow("corruptRestore");
    expect(settings.getGlobalSetting("core")).toBe("keep me");
    expect(fs.readFileSync(enc.keyPath(), "utf8")).toBe(oldKeyHex);
    expect(enc.getKey().toString("hex")).toBe(oldKeyHex);
    expect(fs.existsSync(path.join(dataDir, "penny.db.restore-tmp"))).toBe(false);
  });

  it("rolls back when the restored database fails its integrity check", async () => {
    settings.setGlobalSetting("core", "intact");
    const { bytes } = backup.createBackup(PASS);
    const db = await import("@/server/db");
    const real = db.getDb;
    let calls = 0;
    // The first open after the swap reports damage; the put-back copy opens normally.
    vi.spyOn(db, "getDb").mockImplementation(() => {
      const conn = real();
      if (++calls === 2) vi.spyOn(conn, "pragma").mockReturnValueOnce("*** page 3 corrupt");
      return conn;
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => backup.applyBackup(bytes, PASS)).toThrow("corruptRestore");
    vi.restoreAllMocks();
    expect(settings.getGlobalSetting("core")).toBe("intact");
  });

  it("writes back documents, skipping crafted paths and non-text entries", () => {
    const p = open(backup.createBackup(PASS).bytes);
    const crafted = {
      ...p,
      files: {
        "receipts/new/r.txt": Buffer.from("receipt").toString("base64"),
        "../escape.txt": Buffer.from("no").toString("base64"),
        "receipts/n.txt": 42,
      },
    };
    backup.applyBackup(seal(crafted), PASS);
    expect(fs.readFileSync(path.join(dataDir, "receipts", "new", "r.txt"), "utf8")).toBe("receipt");
    expect(fs.existsSync(path.join(dataDir, "..", "escape.txt"))).toBe(false);
    expect(fs.existsSync(path.join(dataDir, "receipts", "n.txt"))).toBe(false);
  });

  it("restores an older backup that has no files list", () => {
    settings.setGlobalSetting("core", "v-old");
    const p = open(backup.createBackup(PASS).bytes);
    delete p.files;
    settings.setGlobalSetting("core", "v-new");
    const r = backup.applyBackup(seal(p), PASS);
    expect(settings.getGlobalSetting("core")).toBe("v-old");
    expect(r.createdAt).toBe(p.createdAt);
  });
});
