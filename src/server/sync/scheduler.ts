import "server-only";

import { runAllWorkspaces, type WorkspaceSummary } from "@/server/sync/orchestrator";
import { SyncBusyError } from "@/server/sync/lock";
import { getGlobalSetting, setGlobalSetting } from "@/server/db/queries/settings";
import { failInterruptedSyncRuns } from "@/server/db/queries/sync-runs";
import { redactError } from "@/server/lib/redact";
import { isKeyLocked } from "@/server/lib/encryption";
import { dueRun, msUntilNextSlot, type ScheduleState } from "@/lib/sync-schedule";

interface SchedulerState {
  intervalId: ReturnType<typeof setInterval> | null;
  running: boolean;
  initialized: boolean;
  exitHandlerRegistered: boolean;
}

declare global {
  var __pennyScheduler: SchedulerState | undefined;
}

function getState(): SchedulerState {
  if (!globalThis.__pennyScheduler) {
    globalThis.__pennyScheduler = {
      intervalId: null,
      running: false,
      initialized: false,
      exitHandlerRegistered: false,
    };
  }
  return globalThis.__pennyScheduler;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
/**
 * The clock is checked every minute instead of arming one timer for tomorrow: a long timer does not
 * fire on time after the computer sleeps, and never fires for a slot missed while it was off.
 */
const TICK_MS = 60_000;

const LAST_ATTEMPT = "auto_sync_last_attempt";
const RETRY_IDS = "auto_sync_retry_ids";
const RETRIES = "auto_sync_retries";

function readSettings(): { enabled: boolean; time: string } {
  // On unless the user turned it off: a daily sync at 06:00 keeps the data fresh without a button.
  const enabled = getGlobalSetting("auto_sync_enabled") !== "false";
  const time = getGlobalSetting("auto_sync_time");
  const safeTime = time && TIME_RE.test(time) ? time : "06:00";
  return { enabled, time: safeTime };
}

function retryIds(): number[] {
  try {
    const ids: unknown = JSON.parse(getGlobalSetting(RETRY_IDS) ?? "[]");
    return Array.isArray(ids) ? ids.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    // An unreadable list means nothing to retry; the next daily run covers every connection anyway.
    return [];
  }
}

function readSchedule(): ScheduleState {
  const last = Number(getGlobalSetting(LAST_ATTEMPT));
  return {
    lastAttemptMs: Number.isFinite(last) && last > 0 ? last : null,
    retryPending: retryIds().length > 0,
    retries: Number(getGlobalSetting(RETRIES)) || 0,
  };
}

/** Connections that failed for a reason worth trying again today (network, a slow site), not a wrong password. */
export function retryableFailures(summaries: WorkspaceSummary[]): number[] {
  return summaries.flatMap((w) =>
    w.providers.filter((p) => !p.ok && p.retryable).map((p) => p.credentialId),
  );
}

async function tick(): Promise<void> {
  const state = getState();
  if (state.running) return;
  const { enabled, time } = readSettings();
  if (!enabled) return;
  // After a restart with the app lock on, bank passwords stay wrapped until someone unlocks once.
  // Nothing is recorded, so the run happens on the first tick after the unlock.
  if (isKeyLocked()) return;
  const due = dueRun(time, readSchedule());
  if (!due) return;

  state.running = true;
  const startedAt = Date.now();
  const ids = due === "retry" ? retryIds() : [];
  console.log(`[scheduler] running (${due})`);
  try {
    const summaries: WorkspaceSummary[] = [];
    if (due === "full")
      summaries.push(...(await runAllWorkspaces(undefined, undefined, "scheduled")));
    // A retry logs in only to the connections that failed, not to the ones that already synced today.
    else
      for (const id of ids) summaries.push(...(await runAllWorkspaces(id, undefined, "scheduled")));
    setGlobalSetting(LAST_ATTEMPT, String(startedAt));
    setGlobalSetting(RETRY_IDS, JSON.stringify(retryableFailures(summaries)));
    setGlobalSetting(RETRIES, due === "full" ? "0" : String(readSchedule().retries + 1));
    console.log("[scheduler] done");
  } catch (err) {
    // A manual sync is running: nothing is recorded, so the next tick tries again.
    if (err instanceof SyncBusyError)
      console.warn("[scheduler] waiting: a sync is already running");
    else {
      console.error("[scheduler] run failed:", redactError(err));
      // Recorded as an attempt, or a failure that repeats would retry every minute.
      setGlobalSetting(LAST_ATTEMPT, String(startedAt));
      setGlobalSetting(RETRY_IDS, "[]");
    }
  } finally {
    state.running = false;
  }
}

function start(): void {
  const state = getState();
  if (state.intervalId) return;
  state.intervalId = setInterval(() => void tick(), TICK_MS);
  // The check must not keep a finished process (a script, a test) alive.
  state.intervalId.unref();
}

function cancel(): void {
  const state = getState();
  if (state.intervalId) clearInterval(state.intervalId);
  state.intervalId = null;
}

/** Settings are read on every tick, so a changed time or switch needs no re-arming; kept for its callers. */
export function reschedule(): void {
  start();
}

export function initScheduler(): void {
  const state = getState();
  if (!state.initialized) {
    state.initialized = true;
    // Nothing can be mid-sync when the process has just started: a run still marked as running was cut off by a crash or a shutdown.
    try {
      const interrupted = failInterruptedSyncRuns();
      if (interrupted) console.warn(`[scheduler] closed ${interrupted} interrupted sync run(s)`);
    } catch (err) {
      console.error("[scheduler] could not close interrupted runs:", redactError(err));
    }
    registerExitHandlers();
  }
  start();
}

export function getNextRunAt(): string | null {
  const { enabled, time } = readSettings();
  return enabled ? new Date(Date.now() + msUntilNextSlot(time)).toISOString() : null;
}

function registerExitHandlers(): void {
  const state = getState();
  if (state.exitHandlerRegistered) return;
  state.exitHandlerRegistered = true;
  const stop = () => cancel();
  process.on("exit", stop);
  process.on("SIGINT", () => {
    stop();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    stop();
    process.exit(0);
  });
}

/** For tests: one pass of the clock check. */
export const runSchedulerTick = tick;
