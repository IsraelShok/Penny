import { describe, it, expect, beforeAll } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";

let backup: typeof import("@/server/lib/portable-backup");
let getGlobalSetting: typeof import("@/server/db/queries/settings").getGlobalSetting;
let setGlobalSetting: typeof import("@/server/db/queries/settings").setGlobalSetting;
let dir: string;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-safety-"));
  process.env.PENNY_DATA_DIR = dir;
  const settings = await import("@/server/db/queries/settings");
  getGlobalSetting = settings.getGlobalSetting;
  setGlobalSetting = settings.setGlobalSetting;
  backup = await import("@/server/lib/portable-backup");
});

const PASSPHRASE = "correct horse battery";

/** A backup of the live database with its database bytes rewritten. */
function tamperedBackup(change: (db: Buffer) => Buffer): Buffer {
  const payload = backup.readBackup(backup.createBackup(PASSPHRASE).bytes, PASSPHRASE);
  const database = change(Buffer.from(payload.database, "base64")).toString("base64");
  return backup.encryptBackup(Buffer.from(JSON.stringify({ ...payload, database })), PASSPHRASE);
}

/** Runs SQL against database bytes and returns the result as bytes. */
function rewrite(bytes: Buffer, sql: string): Buffer {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "penny-tamper-")), "x.db");
  fs.writeFileSync(file, bytes);
  const db = new Database(file);
  db.exec(sql);
  db.close();
  return fs.readFileSync(file);
}

describe("restore never costs the data in use", () => {
  it("refuses a truncated database before touching the live one", () => {
    setGlobalSetting("safety", "kept");
    const cut = tamperedBackup((db) => db.subarray(0, Math.floor(db.length / 2)));
    expect(() => backup.applyBackup(cut, PASSPHRASE)).toThrow("badFile");
    expect(getGlobalSetting("safety")).toBe("kept");
  });

  it("puts the previous database back when the restored one cannot be opened", () => {
    setGlobalSetting("safety", "kept");
    // Passes the pre-check (a healthy Penny database) and fails only once opened: it claims a migration this build does not have.
    const newer = tamperedBackup((db) =>
      rewrite(
        db,
        "UPDATE settings SET value = 'from backup' WHERE key = 'safety'; INSERT INTO _migrations (name) VALUES ('999_from_the_future.sql')",
      ),
    );
    expect(() => backup.applyBackup(newer, PASSPHRASE)).toThrow("corruptRestore");
    expect(getGlobalSetting("safety")).toBe("kept");
    expect(fs.existsSync(path.join(dir, "penny.db.restore-tmp"))).toBe(false);
  });

  it("takes a complete backup while another connection holds the database open", () => {
    setGlobalSetting("safety", "in the snapshot");
    const reader = new Database(path.join(dir, "penny.db"), { readonly: true });
    reader.exec("BEGIN");
    reader.prepare("SELECT COUNT(*) FROM settings").get();
    try {
      const payload = backup.readBackup(backup.createBackup(PASSPHRASE).bytes, PASSPHRASE);
      const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "penny-copy-")), "c.db");
      fs.writeFileSync(copy, Buffer.from(payload.database, "base64"));
      const db = new Database(copy, { readonly: true });
      expect(db.pragma("quick_check", { simple: true })).toBe("ok");
      expect(
        (db.prepare("SELECT value FROM settings WHERE key = 'safety'").get() as { value: string })
          .value,
      ).toBe("in the snapshot");
      db.close();
    } finally {
      reader.exec("COMMIT");
      reader.close();
    }
  });
});

describe("migration runner", () => {
  it("refuses a database written by a newer version", async () => {
    const { runMigrations } = await import("@/server/db/migrate");
    const db = new Database(":memory:");
    runMigrations(db);
    db.prepare("INSERT INTO _migrations (name) VALUES ('999_from_the_future.sql')").run();
    expect(() => runMigrations(db)).toThrow(/newer version/);
    db.close();
  });
});

describe("backup with the app lock on", () => {
  const post = (body: unknown) =>
    new Request("http://127.0.0.1:3000/api/backup", {
      method: "POST",
      body: JSON.stringify(body),
    });
  const restoreForm = (secret?: string) => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array([1, 2, 3])], "x.pennybak"));
    form.set("passphrase", PASSPHRASE);
    if (secret) form.set("secret", secret);
    return new Request("http://127.0.0.1:3000/api/backup/restore", { method: "POST", body: form });
  };

  it("asks for the lock passphrase again, for export and for restore", async () => {
    const lock = await import("@/server/lib/app-lock");
    const { POST } = await import("@/app/api/backup/route");
    const restore = await import("@/app/api/backup/restore/route");

    expect((await POST(post({ passphrase: PASSPHRASE }))).status).toBe(200);

    await lock.enableLock("lock passphrase", 15);
    try {
      expect((await POST(post({ passphrase: PASSPHRASE }))).status).toBe(401);
      expect((await restore.POST(restoreForm())).status).toBe(429); // backoff after the failure above
      // The backoff is per process; clear it the way a correct entry does.
      await lock.checkSecret("lock passphrase", Date.now() + 60 * 60_000);
      const ok = await POST(post({ passphrase: PASSPHRASE, secret: "lock passphrase" }));
      expect(ok.status).toBe(200);
      // Past the re-auth, the junk file is refused for what it is.
      const bad = await restore.POST(restoreForm("lock passphrase"));
      expect(bad.status).toBe(400);
      expect(((await bad.json()) as { error: string }).error).toBe("badFile");
    } finally {
      await lock.disableLock("lock passphrase");
    }
  });
});
