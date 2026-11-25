import "server-only";

export type SyncLockKind = "manual" | "scheduled";

interface SyncLockState {
  kind: SyncLockKind;
  since: number;
}

declare global {
  var __pennySyncLock: SyncLockState | undefined;
  var __pennyCredentialLocks: Map<number, SyncLockState> | undefined;
}

/**
 * A scrape times out after a minute and a full run is minutes at worst, so a lock older than this
 * means the run died without releasing. Without it one hung scrape would block every later sync.
 */
// Above any real run: every connection is cut off after 10 minutes, so even a household with many takes less.
const STALE_MS = 3 * 60 * 60 * 1000;

export class SyncBusyError extends Error {
  constructor() {
    super("A sync is already running.");
    this.name = "SyncBusyError";
  }
}

function credentialLocks(now = Date.now()): Map<number, SyncLockState> {
  if (!globalThis.__pennyCredentialLocks) {
    globalThis.__pennyCredentialLocks = new Map();
  }
  for (const [id, state] of globalThis.__pennyCredentialLocks) {
    if (now - state.since > STALE_MS) {
      console.warn(`[sync] releasing a stale credential sync lock (${id})`);
      globalThis.__pennyCredentialLocks.delete(id);
    }
  }
  return globalThis.__pennyCredentialLocks;
}

export function isSyncRunning(now = Date.now()): boolean {
  const lock = globalThis.__pennySyncLock;
  if (lock) {
    if (now - lock.since > STALE_MS) {
      console.warn("[sync] releasing a stale sync lock");
      globalThis.__pennySyncLock = undefined;
    } else {
      return true;
    }
  }
  return credentialLocks(now).size > 0;
}

/** Returns the release function for a full sync, or null when any sync already holds a lock. */
export function tryAcquireSync(kind: SyncLockKind): (() => void) | null {
  if (isSyncRunning()) return null;
  const state: SyncLockState = { kind, since: Date.now() };
  globalThis.__pennySyncLock = state;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (globalThis.__pennySyncLock === state) globalThis.__pennySyncLock = undefined;
  };
}

/**
 * Acquires a lock for one bank/card credential so different providers can sync in parallel
 * while preventing duplicate concurrent scrapes of the same credential.
 */
export function tryAcquireCredentialSync(
  credentialId: number,
  kind: SyncLockKind = "manual",
): (() => void) | null {
  const now = Date.now();
  const full = globalThis.__pennySyncLock;
  if (full && now - full.since <= STALE_MS) return null;
  const map = credentialLocks(now);
  if (map.has(credentialId)) return null;
  const state: SyncLockState = { kind, since: now };
  map.set(credentialId, state);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (map.get(credentialId) === state) map.delete(credentialId);
  };
}
