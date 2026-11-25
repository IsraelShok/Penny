import { describe, it, expect, afterEach } from "vitest";
import {
  isSyncRunning,
  SyncBusyError,
  tryAcquireCredentialSync,
  tryAcquireSync,
} from "@/server/sync/lock";

afterEach(() => {
  globalThis.__pennySyncLock = undefined;
  globalThis.__pennyCredentialLocks = undefined;
});

describe("sync lock", () => {
  it("lets one run hold the lock and refuses the second", () => {
    const release = tryAcquireSync("manual");
    expect(release).not.toBeNull();
    expect(isSyncRunning()).toBe(true);
    expect(tryAcquireSync("scheduled")).toBeNull();
    release?.();
    expect(isSyncRunning()).toBe(false);
    expect(tryAcquireSync("scheduled")).not.toBeNull();
  });

  it("releases only once, and never releases a newer lock", () => {
    const first = tryAcquireSync("manual");
    first?.();
    first?.();
    const second = tryAcquireSync("manual");
    first?.();
    expect(isSyncRunning()).toBe(true);
    second?.();
    expect(isSyncRunning()).toBe(false);
  });

  it("takes over a lock older than the stale window", () => {
    globalThis.__pennySyncLock = { kind: "manual", since: Date.now() - 3 * 60 * 60_000 - 60_000 };
    expect(isSyncRunning()).toBe(false);
    expect(tryAcquireSync("manual")).not.toBeNull();
  });

  it("carries a recognisable name for callers that cannot import the class", () => {
    expect(new SyncBusyError().name).toBe("SyncBusyError");
  });

  it("allows different credentials to sync in parallel while blocking duplicates and full syncs", () => {
    const r1 = tryAcquireCredentialSync(1);
    const r2 = tryAcquireCredentialSync(2);
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(tryAcquireCredentialSync(1)).toBeNull();
    expect(tryAcquireSync("manual")).toBeNull();
    expect(isSyncRunning()).toBe(true);
    r1?.();
    expect(isSyncRunning()).toBe(true);
    r2?.();
    expect(isSyncRunning()).toBe(false);
    const full = tryAcquireSync("manual");
    expect(full).not.toBeNull();
    expect(tryAcquireCredentialSync(3)).toBeNull();
    full?.();
  });
});
