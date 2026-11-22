import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Fullstack contract sweep over the whole API surface: real route modules, real handlers,
// real SQLite database, malformed input. Every handler must answer 4xx (not 5xx) to a bad
// request, and a GET must never crash. Routes that leave the machine (scrapers, AI, market
// data) or need a Next request scope are listed below with the reason they are skipped.
process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-contract-"));
process.env.PENNY_UPDATE_CHECK = "0";
process.env.PENNY_DEMO = "0";

const SKIP: { match: string; reason: string }[] = [
  { match: "/api/sync", reason: "streams a sync and launches Chromium" },
  { match: "/api/lock", reason: "reads next/headers cookies, which need a real request scope" },
  { match: "/api/telegram", reason: "calls the Telegram API" },
  { match: "/api/ai/", reason: "reaches a model provider or a local Ollama" },
  { match: "/api/ask", reason: "asks the configured AI provider" },
  { match: "/api/markets", reason: "fetches public market quotes" },
  { match: "/api/currencies", reason: "fetches exchange rates" },
  { match: "/api/setup/bank/test", reason: "launches Chromium to test a bank login" },
  { match: "/api/backup", reason: "writes an archive instead of validating a body" },
];

const isSkipped = (apiPath: string) => SKIP.some((s) => apiPath.startsWith(s.match));

// Answers "no suggestions" to an unreadable table instead of rejecting it: an empty table
// and a broken body mean the same thing here.
const TOLERANT_EMPTY = new Set(["/api/import/sheet/suggest"]);

const modules = import.meta.glob("../src/app/api/**/route.ts") as Record<
  string,
  () => Promise<Record<string, unknown>>
>;

const MUTATING = ["POST", "PUT", "PATCH", "DELETE"] as const;
const BAD_BODIES: (string | undefined)[] = [undefined, "not json", "null", "[]", "{}", '"x"'];

function apiPathOf(file: string): string {
  return "/api" + file.replace("../src/app/api", "").replace(/\/route\.ts$/, "");
}

function paramsOf(apiPath: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const segment of apiPath.split("/")) {
    const m = segment.match(/^\[(.+)\]$/);
    if (m) params[m[1]] = "999999"; // a well-formed id that cannot exist
  }
  return params;
}

function request(apiPath: string, method: string, body?: string): Request {
  return new Request(`http://localhost${apiPath}`, {
    method,
    headers: {
      "content-type": "application/json",
      host: "localhost",
      "x-workspace-id": "1",
    },
    body: method === "GET" ? undefined : body,
  });
}

type Handler = (
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response>;

beforeAll(() => {
  // Touch the database once so migrations run before the sweep.
  return import("@/server/db").then(({ getDb }) => {
    getDb();
  });
});

describe("API contract: no handler crashes on malformed input", () => {
  for (const [file, load] of Object.entries(modules)) {
    const apiPath = apiPathOf(file);
    if (isSkipped(apiPath)) continue;

    it(`${apiPath} answers 4xx, never 5xx`, async () => {
      const mod = await load();
      const ctx = { params: Promise.resolve(paramsOf(apiPath)) };
      const methods = Object.keys(mod).filter((k): k is (typeof MUTATING)[number] | "GET" =>
        [...MUTATING, "GET"].includes(k as string),
      );
      expect(methods.length, `${apiPath} exposes no HTTP handler`).toBeGreaterThan(0);

      for (const method of methods) {
        const handler = mod[method] as Handler;
        if (method === "GET") {
          const res = await handler(request(apiPath, "GET"), ctx);
          expect(res.status, `GET ${apiPath}`).toBeLessThan(500);
          continue;
        }
        for (const body of BAD_BODIES) {
          const res = await handler(request(apiPath, method, body), ctx);
          expect(res.status, `${method} ${apiPath} body=${body}`).toBeLessThan(500);
          // Broken JSON can never be a successful write. DELETE takes no body, and the
          // sheet suggester deliberately answers "nothing to suggest" to an empty table.
          if (body === "not json" && method !== "DELETE" && !TOLERANT_EMPTY.has(apiPath)) {
            expect(res.status, `${method} ${apiPath} body=${body}`).toBeGreaterThanOrEqual(400);
          }
        }
      }
    });
  }
});
