import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "penny-errors-"));
process.env.PENNY_DATA_DIR = path.join(root, "data");
process.env.PENNY_DEMO = "0";

import { ERROR_CODES } from "@/lib/error-codes";
import { friendlyError } from "@/lib/api";
import { domainMessage, errorResponse } from "@/server/lib/api-error";
import { logError, readErrorLog } from "@/server/lib/log";
import { runEach } from "@/server/lib/startup";
import { fetchExternal } from "@/server/lib/fetch-external";

const coded = (code: string, message = "boom") => Object.assign(new Error(message), { code });
const named = (name: string, message = "boom") => Object.assign(new Error(message), { name });

afterEach(() => vi.restoreAllMocks());

describe("errorResponse maps known failures", () => {
  const cases: [unknown, number, string | undefined][] = [
    [coded("SQLITE_FULL", "database or disk is full"), 507, "disk_full"],
    [coded("SQLITE_BUSY"), 503, "db_busy"],
    [coded("SQLITE_BUSY_SNAPSHOT"), 503, "db_busy"],
    [coded("SQLITE_LOCKED"), 503, "db_busy"],
    [coded("SQLITE_CORRUPT"), 500, "db_corrupt"],
    [coded("SQLITE_NOTADB"), 500, "db_corrupt"],
    [coded("SQLITE_READONLY"), 500, "db_unavailable"],
    [coded("SQLITE_CANTOPEN"), 500, "db_unavailable"],
    [named("AppLockedError"), 401, "locked"],
    [named("SyncBusyError", "A sync is already running."), 409, "sync-running"],
    [coded("SQLITE_CONSTRAINT_UNIQUE"), 500, undefined],
    [coded("ENOENT"), 500, undefined],
  ];
  for (const [error, status, code] of cases) {
    it(`${(error as Error).name}/${(error as { code?: string }).code ?? "-"} → ${status} ${code ?? "generic"}`, async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const res = errorResponse("test", error);
      expect(res.status).toBe(status);
      const body = (await res.json()) as { error: string; code?: string };
      expect(body.code).toBe(code);
      expect(body.error).not.toContain("boom");
    });
  }

  it("answers an EditError with its own status and message", async () => {
    const { EditError } = await import("@/server/db/queries/transaction-edits");
    const res = errorResponse("test", new EditError("date must be YYYY-MM-DD", 422));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "date must be YYYY-MM-DD" });
  });

  it("domainMessage only trusts plain errors thrown on purpose", () => {
    expect(domainMessage(new Error("paydayDay must be a number 1-28"))).toBe(
      "paydayDay must be a number 1-28",
    );
    expect(domainMessage(new TypeError("x is not a function"))).toBeNull();
    expect(domainMessage(coded("SQLITE_FULL"))).toBeNull();
    expect(domainMessage("text")).toBeNull();
  });
});

describe("every error code has wording in both languages", () => {
  const hebrew = /[֐-׿]/;
  for (const code of ERROR_CODES) {
    it(code, () => {
      const body = JSON.stringify({ error: "Server text", code });
      const he = friendlyError(500, body, "he");
      const en = friendlyError(500, body, "en");
      expect(he).toMatch(hebrew);
      expect(he).not.toBe(friendlyError(500, "", "he")); // its own message, not the status fallback
      expect(he).not.toContain("Penny"); // Hebrew copy does not use the product name
      expect(en).not.toMatch(hebrew);
      expect(en).not.toBe(friendlyError(500, "", "en"));
      expect(en).not.toBe("Server text");
    });
  }
});

describe("startup", () => {
  it("runs the next step when one throws, and reports the failure", async () => {
    const ran: string[] = [];
    const reported: string[] = [];
    const failed = await runEach(
      {
        scheduler: () => {
          throw new Error("bad cron");
        },
        rejects: async () => {
          throw new Error("async too");
        },
        backup: () => void ran.push("backup"),
        bot: async () => void ran.push("bot"),
      },
      (scope) => reported.push(scope),
    );
    expect(ran).toEqual(["backup", "bot"]);
    expect(failed).toEqual(["scheduler", "rejects"]);
    expect(reported).toEqual(["startup/scheduler", "startup/rejects"]);
  });
});

describe("logError", () => {
  const file = path.join(root, "logs", "errors.log");

  it("masks ID and card numbers in the console line and the file", () => {
    const line = vi.spyOn(console, "error").mockImplementation(() => {});
    logError(
      "sync",
      coded("E_BANK", "login failed for 123456789 card 4580123412341234"),
      { account: "987654321", attempt: 2 },
      file,
    );
    const text = fs.readFileSync(file, "utf8");
    for (const secret of ["123456789", "4580123412341234", "987654321"]) {
      expect(text).not.toContain(secret);
      expect(String(line.mock.calls[0][0])).not.toContain(secret);
    }
    const entry = readErrorLog(50, file).at(-1)!;
    expect(entry).toMatchObject({ scope: "sync", code: "E_BANK" });
    expect(entry.message).toContain("[number]");
    expect(Number.isNaN(Date.parse(entry.at))).toBe(false);
  });

  it("rotates once past the cap and keeps one old file", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fs.writeFileSync(file, "x".repeat(1_100_000) + "\n");
    logError("after-rotate", new Error("first line of the new file"), undefined, file);
    expect(fs.statSync(`${file}.1`).size).toBeGreaterThan(1_000_000);
    expect(readErrorLog(50, file)).toHaveLength(1);
    fs.writeFileSync(file, "y".repeat(1_100_000) + "\n");
    logError("again", new Error("second rotation"), undefined, file);
    expect(fs.readFileSync(`${file}.1`, "utf8").startsWith("y")).toBe(true);
    expect(fs.readdirSync(path.dirname(file)).sort()).toEqual(["errors.log", "errors.log.1"]);
  });

  it("never throws when the log cannot be written", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const blocker = path.join(root, "not-a-folder");
    fs.writeFileSync(blocker, "");
    expect(() =>
      logError("x", new Error("y"), undefined, path.join(blocker, "logs", "errors.log")),
    ).not.toThrow();
    expect(readErrorLog(50, path.join(blocker, "logs", "errors.log"))).toEqual([]);
    // Even a console that throws does not escape.
    vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("stderr closed");
    });
    expect(() => logError("x", new Error("y"), undefined, file)).not.toThrow();
  });
});

describe("external calls have a deadline", () => {
  let server: http.Server;
  let url: string;
  const sockets = new Set<import("node:net").Socket>();
  beforeAll(async () => {
    // Accepts the connection and never answers.
    server = http.createServer(() => {});
    server.on("connection", (s) => sockets.add(s));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });
  afterAll(() => {
    for (const s of sockets) s.destroy();
    server.close();
  });

  it("rejects within the timeout", async () => {
    const started = Date.now();
    await expect(fetchExternal(url, {}, 200)).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("is still aborted by the caller's own signal", async () => {
    const started = Date.now();
    await expect(
      fetchExternal(url, { signal: AbortSignal.timeout(100) }, 10_000),
    ).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("exchange rates come back empty instead of throwing when the source hangs", async () => {
    const realFetch = globalThis.fetch;
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    // Send the Yahoo request to the silent server, and shorten the 5 s deadline for the test.
    vi.stubGlobal("fetch", (_url: unknown, init?: RequestInit) => realFetch(url, init));
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => realTimeout(200));
    const { dailyRates } = await import("@/server/insights/fx-rates");
    await expect(dailyRates(["USD", "EUR"], "2026-11-24")).resolves.toEqual({ USD: [], EUR: [] });
    vi.unstubAllGlobals();
  });
});
