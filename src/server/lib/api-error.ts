import "server-only";

import { NextResponse } from "next/server";
import type { ErrorCode } from "@/lib/error-codes";
import { logError } from "./log";

/**
 * A failure the caller can fix: bad input, a missing id, a conflict. Its message is
 * written for the UI, and `code` lets the client pick its own wording.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const coded = (error: string, status: number, code: ErrorCode) =>
  NextResponse.json({ error, code }, { status });

/** SQLite failures the person can act on. better-sqlite3 reports extended codes (SQLITE_BUSY_SNAPSHOT), hence the prefixes. */
const SQLITE: [prefix: string, status: number, code: ErrorCode, error: string][] = [
  ["SQLITE_BUSY", 503, "db_busy", "The database is busy"],
  ["SQLITE_LOCKED", 503, "db_busy", "The database is busy"],
  ["SQLITE_FULL", 507, "disk_full", "The disk is full"],
  ["SQLITE_CORRUPT", 500, "db_corrupt", "The database file is damaged"],
  ["SQLITE_NOTADB", 500, "db_corrupt", "The database file is damaged"],
  ["SQLITE_READONLY", 500, "db_unavailable", "The database cannot be written"],
  ["SQLITE_CANTOPEN", 500, "db_unavailable", "The database cannot be opened"],
];

/**
 * Known failures that are not bugs. Matched by the name each class sets, not `instanceof`: tests
 * mock those modules, and a class name alone would not survive minification.
 */
function knownResponse(scope: string, error: unknown): NextResponse | null {
  if (!(error instanceof Error)) return null;
  // Same answer the proxy gives a locked app, so the client's lock handling sees one shape.
  if (error.name === "AppLockedError") return coded("locked", 401, "locked");
  if (error.name === "SyncBusyError") return coded(error.message, 409, "sync-running");
  const status = (error as { status?: unknown }).status;
  // EditError: a rejected edit with its own status and a message written for the UI.
  if (error.name === "EditError" && typeof status === "number")
    return NextResponse.json({ error: error.message }, { status });
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string") return null;
  const hit = SQLITE.find(([prefix]) => code.startsWith(prefix));
  if (!hit) return null;
  logError(scope, error);
  return coded(hit[3], hit[1], hit[2]);
}

/**
 * Turns a thrown value into a response. Expected failures keep their status and copy;
 * anything else is a bug: it is logged and answered with a plain 500, so
 * an internal error never looks like the user's typing and internals never reach the UI.
 */
export function errorResponse(scope: string, error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      error.code ? { error: error.message, code: error.code } : { error: error.message },
      { status: error.status },
    );
  }
  const known = knownResponse(scope, error);
  if (known) return known;
  logError(scope, error);
  return NextResponse.json({ error: "Unable to complete the request" }, { status: 500 });
}

/**
 * Wraps a route handler so nothing it throws escapes as Next's bare 500: every export in
 * src/app/api goes through this (tests/route-wrapper.test.ts checks). The handler's own
 * parameters are kept, including the `{ params }` context of dynamic routes.
 */
export function handle<A extends unknown[]>(
  scope: string,
  fn: (...args: A) => Response | Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorResponse(scope, error);
    }
  };
}

/**
 * The request body as JSON, or a 400 the client can word (`bad_json`) instead of a 500.
 * Like Request.json() the result is untyped unless the caller names T; callers validate it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors Request.json(), which returns any
export async function readJson<T = any>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError("Invalid JSON", 400, "bad_json");
  }
}

/**
 * The message of an error a query threw on purpose (`throw new Error("paydayDay must be 1-28")`),
 * or null for anything else: a SQLite or file-system failure carries a `code`, and a bug is a
 * TypeError or similar subclass. Lets a route show validation text without echoing internals.
 */
export function domainMessage(error: unknown): string | null {
  return error instanceof Error && error.constructor === Error && !("code" in error)
    ? error.message
    : null;
}
