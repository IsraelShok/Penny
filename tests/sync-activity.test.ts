import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** What the status card shows about a running sync: nested runs, a stuck one, the scheduler, Ollama. */

let activity: typeof import("@/server/sync/activity");

beforeAll(async () => {
  process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-activity-"));
  activity = await import("@/server/sync/activity");
});
beforeEach(() => {
  globalThis.__pennyActivity = undefined;
  globalThis._ollamaProcess = undefined;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-24T08:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  globalThis._ollamaProcess = undefined;
});

describe("sync activity", () => {
  it("is idle before anything starts", () => {
    const snap = activity.getActivitySnapshot();
    expect(snap.sync).toEqual({ active: false, since: null, kind: null, stale: false });
    expect(snap.ollama).toEqual({ running: false, spawnedByPenny: false });
  });

  it("keeps the first run's start and kind while a nested run starts and ends", () => {
    activity.markSyncStart("scheduled");
    vi.setSystemTime(new Date("2026-11-24T08:01:00Z"));
    activity.markSyncStart("manual");
    activity.markSyncEnd();
    expect(activity.getActivitySnapshot().sync).toEqual({
      active: true,
      since: "2026-11-24T08:00:00.000Z",
      kind: "scheduled",
      stale: false,
    });
    activity.markSyncEnd();
    expect(activity.getActivitySnapshot().sync.active).toBe(false);
    // An extra end never drives the depth below zero.
    activity.markSyncEnd();
    activity.markSyncStart("manual");
    expect(activity.getActivitySnapshot().sync.kind).toBe("manual");
  });

  it("calls a run stuck after five minutes without a heartbeat, and a heartbeat revives it", () => {
    activity.markSyncStart("manual");
    vi.setSystemTime(new Date("2026-11-24T08:05:00Z"));
    expect(activity.getActivitySnapshot().sync.stale).toBe(false);
    vi.setSystemTime(new Date("2026-11-24T08:05:01Z"));
    expect(activity.getActivitySnapshot().sync.stale).toBe(true);
    activity.markSyncHeartbeat();
    expect(activity.getActivitySnapshot().sync.stale).toBe(false);
  });

  it("a heartbeat with nothing running does not start anything", () => {
    activity.markSyncHeartbeat();
    expect(globalThis.__pennyActivity?.lastHeartbeatAt).toBeNull();
  });

  it("reports an Ollama it started only while that process is alive", () => {
    globalThis._ollamaProcess = { killed: false } as never;
    expect(activity.getActivitySnapshot().ollama).toEqual({ running: true, spawnedByPenny: true });
    globalThis._ollamaProcess = { killed: true } as never;
    expect(activity.getActivitySnapshot().ollama.running).toBe(false);
  });
});
