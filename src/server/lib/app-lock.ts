import "server-only";

import crypto from "crypto";
import fs from "fs";
import { promisify } from "util";
import {
  getKey,
  keyPath,
  legacyKeyPath,
  lockFilePath,
  setKeyInMemory,
  writeOwnerOnly,
} from "./encryption";

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
  /** Passkeys with the PRF extension: each holds its own wrap of the data key. */
  passkeys?: StoredPasskey[];
  /** The data key wrapped under the recovery code. The code itself is never stored. */
  recovery?: Wrap;
}

/** AES-256-GCM wrap of the data key under a key-encryption key derived with HKDF from `salt`. */
export interface Wrap {
  salt: string;
  iv: string;
  tag: string;
  wrapped: string;
}

export interface StoredPasskey extends Wrap {
  /** base64url credential id */
  id: string;
  /** base64url COSE public key */
  publicKey: string;
  counter: number;
  transports?: string[];
  /** The host it was registered on; WebAuthn binds a passkey to it. */
  rpID: string;
  /** base64url input the authenticator's PRF is evaluated on; `salt` is the HKDF salt. */
  prfSalt: string;
  createdAt: number;
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

const hkdf = (ikm: Buffer, salt: Buffer, info: string) =>
  Buffer.from(crypto.hkdfSync("sha256", ikm, salt, info, 32));

/** Wraps `key` under HKDF(secret). Only for high-entropy secrets (PRF output, recovery code). */
export function wrapWith(secret: Buffer, info: string, key: Buffer): Wrap {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", hkdf(secret, salt, info), iv);
  const wrapped = Buffer.concat([cipher.update(key), cipher.final()]);
  return {
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    wrapped: wrapped.toString("hex"),
  };
}

/** Throws when the secret is wrong (the GCM tag does not verify). */
export function unwrapWith(secret: Buffer, info: string, w: Wrap): Buffer {
  const kek = hkdf(secret, Buffer.from(w.salt, "hex"), info);
  const decipher = crypto.createDecipheriv("aes-256-gcm", kek, Buffer.from(w.iv, "hex"), {
    authTagLength: 16,
  });
  decipher.setAuthTag(Buffer.from(w.tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(w.wrapped, "hex")), decipher.final()]);
}

const RECOVERY_INFO = "penny-recovery-v1";
const PASSKEY_INFO = "penny-passkey-prf-v1";
// Crockford base32: no I, L, O, U, so the code survives being copied by hand.
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** Uppercase, separators dropped, look-alikes mapped back. */
export const normalizeRecovery = (code: string) =>
  code.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");

function tryRecovery(lock: LockFile, secret: string): Buffer | null {
  if (!lock.recovery) return null;
  const code = normalizeRecovery(secret);
  if (!/^[0-9A-Z]{25}$/.test(code)) return null;
  try {
    return unwrapWith(Buffer.from(code), RECOVERY_INFO, lock.recovery);
  } catch {
    return null;
  }
}

/** New recovery code (125 bits); replaces the old one. Needs the key in memory (unlocked). */
export function regenerateRecovery(): string {
  const lock = readLock();
  if (!lock) throw new Error("not_enabled");
  const code = Array.from(crypto.randomBytes(25), (b) => B32[b & 31]).join("");
  writeLock({ ...lock, recovery: wrapWith(Buffer.from(code), RECOVERY_INFO, getKey()) });
  return code.match(/.{5}/g)!.join("-");
}

export function listPasskeys(): StoredPasskey[] {
  return readLock()?.passkeys ?? [];
}

/** Stores a verified passkey with the data key wrapped under its PRF output. */
export function addPasskey(
  p: Omit<StoredPasskey, keyof Wrap | "createdAt">,
  prfOutput: Buffer,
  now = Date.now(),
): void {
  const lock = readLock();
  if (!lock) throw new Error("not_enabled");
  const entry = { ...p, ...wrapWith(prfOutput, PASSKEY_INFO, getKey()), createdAt: now };
  writeLock({ ...lock, passkeys: [...(lock.passkeys ?? []).filter((k) => k.id !== p.id), entry] });
}

export function removePasskey(id: string): void {
  const lock = readLock();
  if (!lock) return;
  writeLock({ ...lock, passkeys: (lock.passkeys ?? []).filter((k) => k.id !== id) });
}

/** After a verified assertion: unwrap with the PRF output, save the counter, open a session. Throws on a wrong PRF output. */
export function unlockWithPasskey(id: string, prfOutput: Buffer, counter: number): string {
  const lock = readLock();
  const entry = lock?.passkeys?.find((k) => k.id === id);
  if (!lock || !entry) throw new Error("unknown_passkey");
  const key = unwrapWith(prfOutput, PASSKEY_INFO, entry);
  writeLock({
    ...lock,
    passkeys: lock.passkeys!.map((k) => (k.id === id ? { ...k, counter } : k)),
  });
  setKeyInMemory(key);
  return createSession();
}

function writeLock(lock: LockFile): void {
  // Write then rename, so a crash never leaves a half-written file and an unreadable key.
  const tmp = `${lockFilePath()}.tmp`;
  // It holds the wrapped key, so on Windows it gets the same owner-only ACL as the key file.
  writeOwnerOnly(tmp, JSON.stringify(lock));
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
  const wait = backoff(now);
  if (wait) return wait;
  const lock = readLock();
  if (
    !lock ||
    typeof secret !== "string" ||
    !((await verify(lock, secret)) || tryRecovery(lock, secret))
  )
    return failed(now);
  succeeded();
  return { ok: true };
}

/** A "wait" result while backing off, else null. Shared by passphrase, recovery code and passkey. */
export function backoff(now = Date.now()): CheckResult | null {
  const f = fails();
  return now < f.until
    ? { ok: false, reason: "wait", retryAfter: Math.ceil((f.until - now) / 1000) }
    : null;
}

export function failed(now = Date.now()): CheckResult {
  const f = fails();
  f.count += 1;
  f.until = now + Math.min(1000 * 2 ** (f.count - 1), 15 * 60_000);
  return { ok: false, reason: "wrong", retryAfter: Math.ceil((f.until - now) / 1000) };
}

export function succeeded(): void {
  const f = fails();
  f.count = 0;
  f.until = 0;
}

/** Turns the lock on: wraps the current key, removes the plaintext key file, returns the recovery code. */
export async function enableLock(secret: string, idle: number): Promise<string> {
  if (isLockEnabled()) throw new Error("already_enabled");
  const key = getKey();
  writeLock(await build(secret, key, idle));
  shred(keyPath());
  shredLegacyKey(key);
  return regenerateRecovery();
}

/**
 * Shreds the key at the old ./data location only when it is this install's key. That path hangs off the
 * working directory, so with PENNY_DATA_DIR elsewhere it can be another install's (a developer's own) key.
 */
export function shredLegacyKey(key: Buffer | null | undefined): void {
  const legacy = legacyKeyPath();
  if (!key || legacy === keyPath() || !fs.existsSync(legacy)) return;
  if (fs.readFileSync(legacy, "utf8").trim().toLowerCase() === key.toString("hex")) shred(legacy);
}

/** The passphrase, or else the recovery code, opens the key. */
async function unwrapAny(lock: LockFile, secret: string): Promise<Buffer> {
  if (await verify(lock, secret)) return unwrap(lock, secret);
  const key = tryRecovery(lock, secret);
  if (!key) throw new Error("wrong");
  return key;
}

/** Unwraps the key into memory and returns a new session token. Call only after checkSecret succeeded. */
export async function unlock(secret: string): Promise<string> {
  const lock = readLock();
  if (!lock) throw new Error("not_enabled");
  setKeyInMemory(await unwrapAny(lock, secret));
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
  const key = await unwrapAny(lock, current);
  // Passkey and recovery wraps hold the same data key, so they stay valid.
  writeLock({ ...lock, ...(next ? await build(next, key, idle) : { idleMinutes: idle }) });
}

/** Turns the lock off: the plaintext key file comes back, exactly as before the lock. */
export async function disableLock(current: string): Promise<void> {
  const lock = readLock();
  if (!lock) return;
  const key = await unwrapAny(lock, current);
  // Shredding the lock file drops the passkey and recovery wraps with it.
  writeOwnerOnly(keyPath(), key.toString("hex"));
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
