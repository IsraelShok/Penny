import "server-only";

import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./data-dir";
import { redact, redactError } from "./redact";

const MAX_BYTES = 1_000_000;

export type ErrorLogEntry = { at: string; scope: string; code?: string; message: string };

export const errorLogPath = (dir = dataDir()) => path.join(dir, "logs", "errors.log");

const codeOf = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
};

/**
 * The one place server errors are reported: a redacted line on stderr, and the same as a JSON line
 * in <dataDir>/logs/errors.log (one rotation at ~1 MB), so a failure in a background job leaves a
 * trace the person can find. Never throws: a full disk must not turn a logged error into a crash.
 */
export function logError(
  scope: string,
  error: unknown,
  context?: Record<string, string | number | boolean>,
  // Unit tests exercise routes that fail on purpose; they must not write into a real data folder.
  file: string | null = process.env.VITEST ? null : errorLogPath(),
): void {
  try {
    const extra = context ? ` ${redact(JSON.stringify(context))}` : "";
    const message = redactError(error) + extra;
    const code = codeOf(error);
    console.error(`[${scope}] ${message}`);
    if (!file) return;
    const entry: ErrorLogEntry = { at: new Date().toISOString(), scope, code, message };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file) && fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, `${file}.1`);
    fs.appendFileSync(file, JSON.stringify(entry) + "\n", { mode: 0o600 });
  } catch {
    // Nowhere left to report to; the caller's own failure handling must still run.
  }
}

/** The newest `limit` entries, oldest first. Unreadable lines are skipped. */
export function readErrorLog(limit = 50, file = errorLogPath()): ErrorLogEntry[] {
  try {
    // The path is only known at run time; without the hint the bundler traces the whole project.
    const lines = fs
      .readFileSync(/*turbopackIgnore: true*/ file, "utf8")
      .split("\n")
      .filter(Boolean)
      .slice(-limit);
    return lines.flatMap((line) => {
      try {
        return [JSON.parse(line) as ErrorLogEntry];
      } catch {
        return []; // a line cut off by a crash mid-write
      }
    });
  } catch {
    return []; // no log yet
  }
}
