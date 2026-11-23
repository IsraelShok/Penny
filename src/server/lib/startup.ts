import "server-only";

import { logError } from "./log";

declare global {
  var __pennyProcessHandlers: boolean | undefined;
}

/**
 * Runs each startup step on its own: one that throws (a bad schedule setting, a missing key file)
 * is logged and the rest still start, so a broken scheduler cannot also take down backups and the bot.
 * Returns the names of the steps that failed.
 */
export async function runEach(
  steps: Record<string, () => unknown>,
  report: (scope: string, error: unknown) => void = logError,
): Promise<string[]> {
  const failed: string[] = [];
  for (const [name, step] of Object.entries(steps)) {
    try {
      await step();
    } catch (error) {
      failed.push(name);
      report(`startup/${name}`, error);
    }
  }
  return failed;
}

/**
 * Logs promise rejections and exceptions nothing caught. Registered once per process: dev
 * hot-reload calls register() again. A rejection is logged and the server keeps running (with a
 * listener present Node no longer exits on it); the exception monitor only observes.
 */
export function installProcessHandlers(): void {
  if (globalThis.__pennyProcessHandlers) return;
  globalThis.__pennyProcessHandlers = true;
  process.on("unhandledRejection", (reason) => logError("unhandledRejection", reason));
  process.on("uncaughtExceptionMonitor", (error) => logError("uncaughtException", error));
}
