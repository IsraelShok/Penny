import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** The daily scheduler's failure paths: a busy lock, a run that throws, the retry pass, start-up. */

type Run = (
  credentialId?: number,
  onEvent?: unknown,
  kind?: string,
  options?: { lockHeld?: boolean },
) => Promise<unknown[]>;
const orch = vi.hoisted(() => ({ run: null as null | Run, calls: [] as unknown[][] }));
vi.mock("@/server/sync/orchestrator", () => ({
  runAllWorkspaces: (...args: Parameters<Run>) => {
    orch.calls.push(args);
    return orch.run!(...args);
  },
}));

const MIN = 60_000;
const KEYS = [
  "auto_sync_last_attempt",
  "auto_sync_retry_ids",
  "auto_sync_retries",
  "auto_sync_time",
];

let scheduler: typeof import("@/server/sync/scheduler");
let settings: typeof import("@/server/db/queries/settings");
let lock: typeof import("@/server/sync/lock");
let db: import("better-sqlite3").Database;

beforeAll(async () => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-sched-core-"));
  globalThis.__pennyDataKey = undefined;
  db = (await import("@/server/db")).getDb();
  settings = await import("@/server/db/queries/settings");
  lock = await import("@/server/sync/lock");
  scheduler = await import("@/server/sync/scheduler");
});
beforeEach(() => {
  orch.calls.length = 0;
  orch.run = async () => [];
  for (const key of KEYS) db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  globalThis.__pennyScheduler = undefined;
  globalThis.__pennySyncLock = undefined;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  globalThis.__pennySyncLock = undefined;
});

const get = (k: string) => settings.getGlobalSetting(k);
const dueFull = () =>
  settings.setGlobalSetting("auto_sync_last_attempt", String(Date.now() - 3 * 24 * 60 * MIN));
const dueRetry = (ids: unknown) => {
  settings.setGlobalSetting("auto_sync_last_attempt", String(Date.now() - 16 * MIN));
  settings.setGlobalSetting("auto_sync_retry_ids", JSON.stringify(ids));
  settings.setGlobalSetting("auto_sync_retries", "0");
};

describe("scheduler tick", () => {
  it("a run that throws is still recorded as an attempt, so it does not retry every minute", async () => {
    dueFull();
    settings.setGlobalSetting("auto_sync_retry_ids", "[5]");
    orch.run = async () => {
      throw new Error('bank exploded {"password":"hunter2"}');
    };
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const before = Date.now();
    await scheduler.runSchedulerTick();
    expect(Number(get("auto_sync_last_attempt"))).toBeGreaterThanOrEqual(before);
    expect(get("auto_sync_retry_ids")).toBe("[]");
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0][1])).not.toContain("hunter2");
    // The next tick in the same slot does nothing.
    await scheduler.runSchedulerTick();
    expect(orch.calls).toHaveLength(1);
  });

  it("when a manual sync holds the lock, records nothing so the next tick tries again", async () => {
    dueFull();
    const last = get("auto_sync_last_attempt");
    orch.run = async () => {
      throw new lock.SyncBusyError();
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await scheduler.runSchedulerTick();
    expect(warn).toHaveBeenCalledWith("[scheduler] waiting: a sync is already running");
    expect(get("auto_sync_last_attempt")).toBe(last);

    orch.run = async () => [];
    await scheduler.runSchedulerTick();
    expect(orch.calls).toHaveLength(2);
    expect(get("auto_sync_last_attempt")).not.toBe(last);
    expect(get("auto_sync_retries")).toBe("0");
  });

  it("the retry pass holds one lock for every connection it retries", async () => {
    dueRetry([2, 3]);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const heldDuring: boolean[] = [];
    orch.run = async (id, _e, kind, options) => {
      heldDuring.push(lock.isSyncRunning());
      expect(kind).toBe("scheduled");
      expect(options).toEqual({ lockHeld: true });
      return [
        {
          providers: [{ ok: id !== 3, retryable: id === 3, credentialId: id }],
        },
      ];
    };
    await scheduler.runSchedulerTick();
    expect(orch.calls.map((c) => c[0])).toEqual([2, 3]);
    expect(heldDuring).toEqual([true, true]);
    expect(lock.isSyncRunning()).toBe(false); // released afterwards
    expect(get("auto_sync_retry_ids")).toBe("[3]");
    expect(get("auto_sync_retries")).toBe("1");
  });

  it("the retry pass waits when a manual sync is running, without touching the record", async () => {
    dueRetry([2]);
    const release = lock.tryAcquireSync("manual")!;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const last = get("auto_sync_last_attempt");
    await scheduler.runSchedulerTick();
    release();
    expect(orch.calls).toEqual([]);
    expect(warn).toHaveBeenCalledWith("[scheduler] waiting: a sync is already running");
    expect(get("auto_sync_last_attempt")).toBe(last);
    expect(get("auto_sync_retry_ids")).toBe("[2]");
  });

  it("the retry pass releases its lock when a retry throws", async () => {
    dueRetry([2]);
    orch.run = async () => {
      throw new Error("boom");
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await scheduler.runSchedulerTick();
    expect(lock.isSyncRunning()).toBe(false);
    expect(get("auto_sync_retry_ids")).toBe("[]");
  });

  it("an unreadable retry list means nothing to retry", async () => {
    settings.setGlobalSetting("auto_sync_last_attempt", String(Date.now() - 16 * MIN));
    for (const bad of ["not json", '{"a":1}', '["x", 1.5]']) {
      settings.setGlobalSetting("auto_sync_retry_ids", bad);
      await scheduler.runSchedulerTick();
    }
    expect(orch.calls).toEqual([]);
  });

  it("skips integers only: a list with junk retries the real ids", async () => {
    dueRetry([4, "x", 2.5, null]);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await scheduler.runSchedulerTick();
    expect(orch.calls.map((c) => c[0])).toEqual([4]);
  });

  it("does not start a second run while one is in progress", async () => {
    dueFull();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    let finish!: () => void;
    orch.run = () => new Promise((r) => (finish = () => r([])));
    const first = scheduler.runSchedulerTick();
    await vi.waitFor(() => expect(orch.calls).toHaveLength(1));
    await scheduler.runSchedulerTick();
    expect(orch.calls).toHaveLength(1);
    finish();
    await first;
    expect(globalThis.__pennyScheduler?.running).toBe(false);
  });

  it("with the app lock on, waits for an unlock and records nothing", async () => {
    dueFull();
    const last = get("auto_sync_last_attempt");
    const enc = await import("@/server/lib/encryption");
    fs.writeFileSync(enc.lockFilePath(), "{}");
    const key = globalThis.__pennyDataKey;
    globalThis.__pennyDataKey = undefined;
    try {
      await scheduler.runSchedulerTick();
    } finally {
      fs.rmSync(enc.lockFilePath());
      globalThis.__pennyDataKey = key;
    }
    expect(orch.calls).toEqual([]);
    expect(get("auto_sync_last_attempt")).toBe(last);
  });

  it("after an upgrade, counts the latest sync as the last attempt instead of syncing at once", async () => {
    const ws = (db.prepare("SELECT id FROM workspaces LIMIT 1").get() as { id: number }).id;
    // A sync a minute ago, in SQLite's UTC text form.
    const at = new Date(Math.floor((Date.now() - MIN) / 1000) * 1000);
    db.prepare(
      "INSERT INTO sync_runs (workspace_id, provider, started_at, status, scrape_from_date) VALUES (?, 'leumi', ?, 'completed', '2026-01-01')",
    ).run(ws, at.toISOString().slice(0, 19).replace("T", " "));
    await scheduler.runSchedulerTick();
    expect(Number(get("auto_sync_last_attempt"))).toBe(at.getTime());
    expect(orch.calls).toEqual([]);
  });
});

describe("settings", () => {
  it("falls back to 06:00 for a malformed time", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
    settings.setGlobalSetting("auto_sync_enabled", "true");
    settings.setGlobalSetting("auto_sync_time", "06:00");
    const six = scheduler.getNextRunAt();
    for (const bad of ["25:00", "6:00", "06:60", "noon"]) {
      settings.setGlobalSetting("auto_sync_time", bad);
      expect(scheduler.getNextRunAt()).toBe(six);
    }
    settings.setGlobalSetting("auto_sync_time", "23:59");
    const late = new Date(scheduler.getNextRunAt()!);
    expect(late.getTime()).toBeGreaterThan(Date.now());
    expect(late.getTime() - Date.now()).toBeLessThanOrEqual(24 * 60 * MIN);
  });
});

describe("retryableFailures", () => {
  it("keeps only connections that failed for a reason worth retrying", () => {
    expect(
      scheduler.retryableFailures([
        {
          providers: [
            { ok: true, retryable: true, credentialId: 1 },
            { ok: false, retryable: true, credentialId: 2 },
            { ok: false, credentialId: 3 },
          ],
        },
        { providers: [{ ok: false, retryable: true, credentialId: 4 }] },
      ] as never),
    ).toEqual([2, 4]);
  });
});

describe("initScheduler", () => {
  it("closes interrupted runs once, arms a minute clock that does not hold the process, and stops on exit", () => {
    const handlers = new Map<string, () => void>();
    vi.spyOn(process, "on").mockImplementation(((ev: string, fn: () => void) => {
      handlers.set(ev, fn);
      return process;
    }) as never);
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    const ws = (db.prepare("SELECT id FROM workspaces LIMIT 1").get() as { id: number }).id;
    db.prepare(
      "INSERT INTO sync_runs (workspace_id, provider, started_at, status, scrape_from_date) VALUES (?, 'leumi', datetime('now'), 'running', '2026-11-01')",
    ).run(ws);

    scheduler.initScheduler();
    const state = globalThis.__pennyScheduler!;
    expect(state.initialized).toBe(true);
    expect(state.intervalId).not.toBeNull();
    expect(warn).toHaveBeenCalledWith("[scheduler] closed 1 interrupted sync run(s)");
    expect([...handlers.keys()].sort()).toEqual(["SIGINT", "SIGTERM", "exit"]);
    expect(vi.getTimerCount()).toBe(1);

    // Calling again (another route import) arms nothing new.
    const id = state.intervalId;
    scheduler.initScheduler();
    scheduler.reschedule();
    expect(state.intervalId).toBe(id);
    expect(vi.getTimerCount()).toBe(1);

    handlers.get("exit")!();
    expect(state.intervalId).toBeNull();
    expect(vi.getTimerCount()).toBe(0);

    scheduler.reschedule();
    handlers.get("SIGTERM")!();
    expect(exit).toHaveBeenCalledWith(0);
    scheduler.reschedule();
    handlers.get("SIGINT")!();
    expect(exit).toHaveBeenCalledTimes(2);
    expect(state.intervalId).toBeNull();
  });

  it("the armed clock runs a tick every minute", async () => {
    vi.spyOn(process, "on").mockImplementation((() => process) as never);
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    dueFull();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    scheduler.reschedule();
    await vi.advanceTimersByTimeAsync(MIN);
    await vi.waitFor(() => expect(orch.calls).toHaveLength(1));
    clearInterval(globalThis.__pennyScheduler!.intervalId!);
  });

  it("a database that cannot close interrupted runs does not stop the scheduler", async () => {
    vi.spyOn(process, "on").mockImplementation((() => process) as never);
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const runs = await import("@/server/db/queries/sync-runs");
    vi.spyOn(runs, "failInterruptedSyncRuns").mockImplementation(() => {
      throw new Error("database is locked");
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    scheduler.initScheduler();
    expect(err.mock.calls[0][0]).toBe("[scheduler] could not close interrupted runs:");
    expect(globalThis.__pennyScheduler!.intervalId).not.toBeNull();
    clearInterval(globalThis.__pennyScheduler!.intervalId!);
  });
});
