import "server-only";

import { execFileSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { dataDir } from "./data-dir";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

// The key lives next to the database, so a Docker volume or PENNY_DATA_DIR keeps both together.
export function keyPath(): string {
  return path.join(dataDir(), ".encryption-key");
}

// Before PENNY_DATA_DIR applied to the key, it was always written to ./data.
export function legacyKeyPath(): string {
  return path.join(process.cwd(), "data", ".encryption-key");
}

/**
 * Writes a secret file only its owner can read: mode 0600, and on Windows (where mode bits mean
 * nothing and the file would inherit the folder's ACL) an ACL holding the current user alone.
 */
export function writeOwnerOnly(file: string, content: string): void {
  fs.writeFileSync(file, content, { mode: 0o600 });
  if (process.platform !== "win32") {
    // The mode above applies only when the file is created.
    fs.chmodSync(file, 0o600);
    return;
  }
  try {
    execFileSync(
      path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "icacls.exe"),
      [file, "/inheritance:r", "/grant:r", `${os.userInfo().username}:F`],
      { stdio: "ignore", windowsHide: true },
    );
  } catch (err) {
    console.warn(
      `[security] could not restrict ${file} to the current user:`,
      err instanceof Error ? err.message : err,
    );
  }
}

export function assertKeyFileMode(stat: fs.Stats, file: string): void {
  // POSIX-only. Windows NTFS ACLs don't map to mode bits meaningfully,
  // so skip there: writeOwnerOnly sets a current-user-only ACL when the file is written.
  if (process.platform === "win32") return;

  const mode = stat.mode & 0o777;
  if (mode !== 0o600) {
    throw new Error(
      `Refusing to read encryption key: ${file} has mode ${mode.toString(8).padStart(3, "0")}, expected 600. ` +
        `Fix with: chmod 600 ${file}`,
    );
  }
}

/** SECURITY.md: a key file readable by others stops the server at startup, not at first use. */
export function checkKeyFileAtStartup(): void {
  const file = keyPath();
  if (!fs.existsSync(file)) return;
  try {
    assertKeyFileMode(fs.statSync(file), file);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

function getOrCreateKey(): Buffer {
  const file = keyPath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Adopt a key from the old location; a new key would make saved credentials unreadable.
  const legacy = legacyKeyPath();
  if (!fs.existsSync(file) && legacy !== file && fs.existsSync(legacy)) {
    assertKeyFileMode(fs.statSync(legacy), legacy);
    writeOwnerOnly(file, fs.readFileSync(legacy, "utf-8").trim());
  }

  if (fs.existsSync(file)) {
    assertKeyFileMode(fs.statSync(file), file);
    return Buffer.from(fs.readFileSync(file, "utf-8").trim(), "hex");
  }

  const key = crypto.randomBytes(32);
  writeOwnerOnly(file, key.toString("hex"));
  return key;
}

/** With the app lock on, only the passphrase-wrapped key is on disk (see app-lock.ts). */
export function lockFilePath(): string {
  return path.join(dataDir(), ".app-lock.json");
}

export const APP_LOCKED_MESSAGE = "האפליקציה נעולה — פתחו אותה כדי לסנכרן";

export class AppLockedError extends Error {
  constructor() {
    super(APP_LOCKED_MESSAGE);
    this.name = "AppLockedError";
  }
}

// On globalThis so the proxy, route handlers and background jobs share one unwrapped key.
declare global {
  var __pennyDataKey: Buffer | undefined;
}

/** True when the lock is on and the key has not been unwrapped since the last restart. */
export function isKeyLocked(): boolean {
  return !globalThis.__pennyDataKey && fs.existsSync(lockFilePath());
}

export function getKey(): Buffer {
  if (!globalThis.__pennyDataKey) {
    if (fs.existsSync(lockFilePath())) throw new AppLockedError();
    globalThis.__pennyDataKey = getOrCreateKey();
  }
  return globalThis.__pennyDataKey;
}

export function setKeyInMemory(key: Buffer | undefined): void {
  globalThis.__pennyDataKey = key;
}

export interface EncryptedData {
  encrypted: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export function encrypt(plaintext: string): EncryptedData {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { encrypted, iv, authTag };
}

export function decrypt(data: EncryptedData): string {
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, data.iv, { authTagLength: 16 });
  decipher.setAuthTag(data.authTag);

  return Buffer.concat([decipher.update(data.encrypted), decipher.final()]).toString("utf-8");
}
