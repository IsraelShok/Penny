import "server-only";

import crypto from "crypto";
import fs from "fs";
import { promisify } from "util";
import { getKey, keyPath, legacyKeyPath, lockFilePath, setKeyInMemory } from "./encryption";

/**
 * Optional app lock. One file, <data>/.app-lock.json, holds the scrypt hash of the passphrase and the
 * data key wrapped (AES-256-GCM) with a separate scrypt-derived key. Sessions live only in memory.
 */

const scrypt = promisify(crypto.scrypt) as (
  pw: string,
  salt: Buffer,
  len: number,
  opts: crypto.ScryptOptions,
) => Promise<Buffer>;
// New locks use N=2^17: about 128 MB and a quarter second per guess, which is the whole
// defence once the data directory has been copied and the attack is offline. Lock files
// written before this change keep the N they carry, so an existing PIN still unlocks.
const SCRYPT_NEW = 2 ** 17;
const SCRYPT_LEGACY = 2 ** 15;
const scryptOptions = (n: number): crypto.ScryptOptions => ({
  N: n,
  r: 8,
  p: 1,
  // scrypt needs about 128 * N * r bytes; leave a wide margin.
  maxmem: 128 * n * 8 * 2,
});
export const IDLE_CHOICES = [5, 15, 60] as const;
export const SESSION_COOKIE = "penny_session";

interface LockFile {
  v: 1;
  /** scrypt cost this lock was built with; absent in files written before the bump. */
  n?: number;
  hashSalt: string;
  hash: string;
  kekSalt: string;
  iv: string;
  tag: string;
  wrapped: string;
  idleMinutes: number;
}

declare global {
  var __pennySessions: Map<string, number> | undefined;
  var __pennyUnlockFails: { count: number; until: number } | undefined;
}

const sessions = () => (globalThis.__pennySessions ??= new Map());
const fails = () => (globalThis.__pennyUnlockFails ??= { count: 0, until: 0 });

export function isLockEnabled(): boolean {
  return fs.existsSync(lockFilePath());
}

function readLock(): LockFile | null {
  try {
    return JSON.parse(fs.readFileSync(lockFilePath(), "utf-8")) as LockFile;
  } catch {
    return null;
  }
}

export function idleMinutes(): number {
  return readLock()?.idleMinutes ?? 15;
}

/** Passphrase or PIN of 8+ characters. A 6-digit PIN leaves only a million offline guesses. */
export function isValidSecret(secret: unknown): secret is string {
  return typeof secret === "string" && secret.length >= 8;
}

async function build(secret: string, key: Buffer, idle: number): Promise<LockFile> {
  const hashSalt = crypto.randomBytes(16);
  const kekSalt = crypto.randomBytes(16);
  const hash = await scrypt(secret, hashSalt, 32, scryptOptions(SCRYPT_NEW));
  const kek = await scrypt(secret, kekSalt, 32, scryptOptions(SCRYPT_NEW));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", kek, iv);
  const wrapped = Buffer.concat([cipher.update(key), cipher.final()]);
  return {
    v: 1,
    n: SCRYPT_NEW,
    hashSalt: hashSalt.toString("hex"),
    hash: hash.toString("hex"),
    kekSalt: kekSalt.toString("hex"),
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    wrapped: wrapped.toString("hex"),
    idleMinutes: idle,
  };
}

function writeLock(lock: LockFile): void {
  // Write then rename, so a crash never leaves a half-written file and an unreadable key.
  const tmp = `${lockFilePath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(lock), { mode: 0o600 });
  fs.renameSync(tmp, lockFilePath());
}

/** Overwrites a file with random bytes before unlinking it. Best effort on SSDs and copy-on-write disks. */
export function shred(file: string): void {
  if (!fs.existsSync(file)) return;
  const size = fs.statSync(file).size;
  const fd = fs.openSync(file, "r+");
  try {
    fs.writeSync(fd, crypto.randomBytes(Math.max(size, 64)), 0, Math.max(size, 64), 0);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.unlinkSync(file);
}

async function verify(lock: LockFile, secret: string): Promise<boolean> {
  const hash = await scrypt(
    secret,
    Buffer.from(lock.hashSalt, "hex"),
    32,
    scryptOptions(lock.n ?? SCRYPT_LEGACY),
  );
  return crypto.timingSafeEqual(hash, Buffer.from(lock.hash, "hex"));
}

async function unwrap(lock: LockFile, secret: string): Promise<Buffer> {
  const kek = await scrypt(
    secret,
    Buffer.from(lock.kekSalt, "hex"),
    32,
    scryptOptions(lock.n ?? SCRYPT_LEGACY),
  );
  const decipher = crypto.createDecipheriv("aes-256-gcm", kek, Buffer.from(lock.iv, "hex"), {
    authTagLength: 16,
  });
  decipher.setAuthTag(Buffer.from(lock.tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(lock.wrapped, "hex")), decipher.final()]);
}

export type CheckResult =
  { ok: true } | { ok: false; reason: "wrong" | "wait"; retryAfter?: number };

/** Verifies the current passphrase, with exponential backoff after failures (1s, 2s, 4s ... up to 15 min). */
export async function checkSecret(secret: unknown, now = Date.now()): Promise<CheckResult> {
  const f = fails();
  if (now < f.until)
    return { ok: false, reason: "wait", retryAfter: Math.ceil((f.until - now) / 1000) };
  const lock = readLock();
  if (!lock || typeof secret !== "string" || !(await verify(lock, secret))) {
    f.count += 1;
    f.until = now + Math.min(1000 * 2 ** (f.count - 1), 15 * 60_000);
    return { ok: false, reason: "wrong", retryAfter: Math.ceil((f.until - now) / 1000) };
  }
  f.count = 0;
  f.until = 0;
  return { ok: true };
}

/** Turns the lock on: wraps the current key and removes the plaintext key file. */
export async function enableLock(secret: string, idle: number): Promise<void> {
  if (isLockEnabled()) throw new Error("already_enabled");
  const key = getKey();
  writeLock(await build(secret, key, idle));
  shred(keyPath());
  if (legacyKeyPath() !== keyPath()) shred(legacyKeyPath());
}

/** Unwraps the key into memory and returns a new session token. Call only after checkSecret succeeded. */
export async function unlock(secret: string): Promise<string> {
  const lock = readLock();
  if (!lock) throw new Error("not_enabled");
  setKeyInMemory(await unwrap(lock, secret));
  return createSession();
}

/** New passphrase and/or idle time; re-wraps with fresh salts. */
export async function changeLock(
  current: string,
  next: string | null,
  idle: number,
): Promise<void> {
  const lock = readLock();
  if (!lock) throw new Error("not_enabled");
  const key = await unwrap(lock, current);
  writeLock(next ? await build(next, key, idle) : { ...lock, idleMinutes: idle });
}

/** Turns the lock off: the plaintext key file comes back, exactly as before the lock. */
export async function disableLock(current: string): Promise<void> {
  const lock = readLock();
  if (!lock) return;
  const key = await unwrap(lock, current);
  fs.writeFileSync(keyPath(), key.toString("hex"), { mode: 0o600 });
  setKeyInMemory(key);
  shred(lockFilePath());
  sessions().clear();
}

export function createSession(now = Date.now()): string {
  const token = crypto.randomBytes(32).toString("base64url");
  sessions().set(token, now + idleMinutes() * 60_000);
  return token;
}

/** True for a live session; each hit pushes the idle expiry forward. */
export function touchSession(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const expires = sessions().get(token);
  if (!expires || expires <= now) {
    sessions().delete(token ?? "");
    return false;
  }
  sessions().set(token, now + idleMinutes() * 60_000);
  return true;
}

export function endSession(token: string | undefined): void {
  if (token) sessions().delete(token);
}

export function endAllSessions(): void {
  sessions().clear();
  globalThis.__pennyUnlockFails = undefined;
}
