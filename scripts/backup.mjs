#!/usr/bin/env node
// Creates one passphrase-encrypted backup file from the command line. The format matches
// src/server/lib/portable-backup.ts, so Settings can restore a file this script wrote.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import Database from "better-sqlite3";

// Same file format as the app writes (src/server/lib/portable-backup.ts): magic, one byte log2(N), salt, iv, tag, body.
const MAGIC = Buffer.from("PENNYBK2");
const LOG_N = 17;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const SCRYPT = { N: 1 << LOG_N, r: 8, p: 1, maxmem: 256 * (1 << LOG_N) * 8 };
const MIN_PASSPHRASE = 8;

const dataDir = process.env.PENNY_DATA_DIR
  ? path.resolve(process.env.PENNY_DATA_DIR)
  : path.join(process.cwd(), "data");
const dbFile = path.join(dataDir, "penny.db");
const keyFile = path.join(dataDir, ".encryption-key");

if (!fs.existsSync(dbFile)) {
  console.error(`No database at ${dbFile}. Set PENNY_DATA_DIR if it lives elsewhere.`);
  process.exit(1);
}
// With the app lock on, the key exists only wrapped by the lock passphrase; a backup without it can't read saved logins.
if (fs.existsSync(path.join(dataDir, ".app-lock.json"))) {
  console.error(
    "The app lock is on, so the encryption key is not on disk. Make the backup in the app: Settings -> Backup.",
  );
  process.exit(1);
}

// Insurance documents and receipts, as in collectDataFiles (src/server/lib/portable-backup.ts).
function collectDataFiles(root) {
  const out = {};
  const walk = (rel) => {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child);
      else if (e.isFile()) out[child] = fs.readFileSync(path.join(root, child)).toString("base64");
    }
  };
  for (const dir of ["policies", "receipts"]) walk(dir);
  return out;
}

async function askPassphrase() {
  const fromEnv = process.env.PENNY_BACKUP_PASSPHRASE ?? "";
  if (fromEnv.length >= MIN_PASSPHRASE) return fromEnv;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const first = await rl.question(
      `Backup passphrase (at least ${MIN_PASSPHRASE} characters, it echoes): `,
    );
    if (first.length < MIN_PASSPHRASE) throw new Error("The passphrase is too short.");
    const again = await rl.question("Again: ");
    if (again !== first) throw new Error("The passphrases do not match.");
    return first;
  } finally {
    rl.close();
  }
}

const passphrase = await askPassphrase();

// VACUUM INTO writes a consistent snapshot without touching the live database.
const snapshot = path.join(os.tmpdir(), `penny-backup-${process.pid}-${Date.now()}.db`);
try {
  const db = new Database(dbFile);
  try {
    db.exec(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }

  const payload = {
    format: 1,
    createdAt: new Date().toISOString(),
    appVersion: "cli",
    database: fs.readFileSync(snapshot).toString("base64"),
    encryptionKey: fs.existsSync(keyFile) ? fs.readFileSync(keyFile).toString("base64") : null,
    files: collectDataFiles(dataDir),
  };
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = crypto.scryptSync(passphrase, salt, 32, SCRYPT);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload), "utf8")),
    cipher.final(),
  ]);
  const file = Buffer.concat([MAGIC, Buffer.from([LOG_N]), salt, iv, cipher.getAuthTag(), body]);

  const outDir = path.join(dataDir, "backups");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const target = path.join(outDir, `penny-backup-${stamp}.pennybak`);
  fs.writeFileSync(target, file);
  console.log(`Backup written: ${target} (${(file.length / 1024 / 1024).toFixed(1)} MB)`);
  console.log(
    "Restore it from Settings -> Accounts and import -> Data -> Restore, or in a new install.",
  );
} finally {
  fs.rmSync(snapshot, { force: true });
}
