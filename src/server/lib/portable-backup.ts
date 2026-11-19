import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { closeDb, getDb } from "@/server/db";
import { backupBeforeMigration, backupDir } from "@/server/db/backup";
import { dataDir, dbPath } from "@/server/lib/data-dir";
import { keyPath } from "@/server/lib/encryption";

/**
 * One portable, passphrase-encrypted file holding the database and the key that decrypts the
 * credentials in it. Losing the key would leave the credentials unreadable, so both travel together.
 */
const MAGIC = Buffer.from("PENNYBK1");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SQLITE_HEADER = Buffer.from("SQLite format 3\u0000");
export const MIN_PASSPHRASE = 8;

export interface BackupPayload {
  format: 1;
  createdAt: string;
  appVersion: string;
  database: string;
  encryptionKey: string | null;
}

export interface BackupCounts {
  transactions: number;
  from: string | null;
  to: string | null;
}

const derive = (passphrase: string, salt: Buffer) => crypto.scryptSync(passphrase, salt, 32, SCRYPT);

export function encryptBackup(plain: Buffer, passphrase: string): Buffer {
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", derive(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

/** Throws "badFile" for anything that is not a Penny backup, "badPassphrase" when the tag fails. */
export function decryptBackup(file: Buffer, passphrase: string): Buffer {
  const header = MAGIC.length + SALT_BYTES + IV_BYTES + TAG_BYTES;
  if (file.length <= header || !file.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("badFile");
  const salt = file.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
  const iv = file.subarray(MAGIC.length + SALT_BYTES, MAGIC.length + SALT_BYTES + IV_BYTES);
  const tag = file.subarray(MAGIC.length + SALT_BYTES + IV_BYTES, header);
  const body = file.subarray(header);
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", derive(passphrase, salt), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    throw new Error("badPassphrase");
  }
}

/** Reads a backup file back into its payload, refusing anything that is not one. */
export function readBackup(file: Buffer, passphrase: string): BackupPayload {
  const plain = decryptBackup(file, passphrase);
  let payload: BackupPayload;
  try {
    payload = JSON.parse(plain.toString("utf8")) as BackupPayload;
  } catch {
    throw new Error("badFile");
  }
  if (payload?.format !== 1 || typeof payload.database !== "string" || !isSqlite(Buffer.from(payload.database, "base64"))) {
    throw new Error("badFile");
  }
  return payload;
}

export function isSqlite(bytes: Buffer): boolean {
  return bytes.length > SQLITE_HEADER.length && bytes.subarray(0, SQLITE_HEADER.length).equals(SQLITE_HEADER);
}

function countsOf(db: Database.Database): BackupCounts {
  try {
    const row = db.prepare("SELECT COUNT(*) AS n, MIN(substr(date, 1, 10)) AS from, MAX(substr(date, 1, 10)) AS to FROM transactions").get() as {
      n: number;
      from: string | null;
      to: string | null;
    };
    return { transactions: row.n, from: row.from, to: row.to };
  } catch {
    return { transactions: 0, from: null, to: null };
  }
}

export function backupFileName(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return `penny-backup-${stamp}.pennybak`;
}

/** Checkpoints WAL, then encrypts the database file and the key into one buffer. */
export function createBackup(passphrase: string): { bytes: Buffer; fileName: string; counts: BackupCounts } {
  if (passphrase.length < MIN_PASSPHRASE) throw new Error("weakPassphrase");
  const db = getDb();
  db.pragma("wal_checkpoint(TRUNCATE)");
  const file = dbPath();
  if (!fs.existsSync(file)) throw new Error("noDatabase");
  const payload: BackupPayload = {
    format: 1,
    createdAt: new Date().toISOString(),
    appVersion: process.env.npm_package_version ?? "1.0.0",
    database: fs.readFileSync(file).toString("base64"),
    encryptionKey: fs.existsSync(keyPath()) ? fs.readFileSync(keyPath()).toString("base64") : null,
  };
  return {
    bytes: encryptBackup(Buffer.from(JSON.stringify(payload), "utf8"), passphrase),
    fileName: backupFileName(),
    counts: countsOf(db),
  };
}

export interface BackupFileInfo {
  name: string;
  size: number;
  at: string;
}

/** The encrypted backups already on disk, newest first. */
export function listBackups(): BackupFileInfo[] {
  const dir = backupDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".pennybak"))
    .map((name) => {
      const st = fs.statSync(path.join(dir, name));
      return { name, size: st.size, at: st.mtime.toISOString() };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Opens the restored bytes in a temp file to be sure they are a Penny database before touching ours. */
function opensAsPennyDatabase(bytes: Buffer): boolean {
  if (!isSqlite(bytes)) return false;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-restore-"));
  const file = path.join(dir, "check.db");
  try {
    fs.writeFileSync(file, bytes);
    const probe = new Database(file, { readonly: true, fileMustExist: true });
    try {
      const tables = probe.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
      return tables.some((t) => t.name === "transactions") && tables.some((t) => t.name === "workspaces");
    } finally {
      probe.close();
    }
  } catch {
    return false;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export interface RestoreResult {
  counts: BackupCounts;
  preRestoreBackup: string | null;
  createdAt: string;
}

/**
 * Replaces the live database with a backup, once the passphrase is checked. The current database is
 * copied to data/backups first, so a wrong file is one more restore away from being undone.
 */
export function applyBackup(file: Buffer, passphrase: string): RestoreResult {
  const payload = readBackup(file, passphrase);
  const database = Buffer.from(payload.database, "base64");
  if (!opensAsPennyDatabase(database)) throw new Error("badFile");

  const db = getDb();
  const preRestoreBackup = backupBeforeMigration(db, "restore");
  const target = dbPath();
  closeDb();
  for (const suffix of ["-wal", "-shm"]) fs.rmSync(`${target}${suffix}`, { force: true });
  fs.writeFileSync(target, database);
  if (payload.encryptionKey) {
    const key = Buffer.from(payload.encryptionKey, "base64");
    // Credentials in the backup were encrypted with this key, so the restored database needs it.
    if (key.length === 32) {
      fs.writeFileSync(keyPath(), key, { mode: 0o600 });
      fs.chmodSync(keyPath(), 0o600);
    }
  }
  const fresh = getDb();
  const check = fresh.pragma("quick_check") as { quick_check: string }[];
  if (!check.every((row) => row.quick_check === "ok")) throw new Error("corruptRestore");
  return { counts: countsOf(fresh), preRestoreBackup, createdAt: payload.createdAt };
}

/** Where the app keeps its data, for the settings card. */
export const dataDirectory = dataDir;
