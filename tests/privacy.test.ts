import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Privacy: what Penny promises to keep inside the machine has to be true in the responses
// people can download or screenshot for support. These tests plant a sentinel secret and a
// sentinel merchant, then check that neither can leave through diagnostics, integrations,
// exports or logs.
process.env.PENNY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "penny-privacy-"));

const SECRET_PASSWORD = "sentinel-bank-password-42";
const SECRET_MERCHANT = "sentinel-merchant-name-42";

beforeAll(async () => {
  const { getDb } = await import("@/server/db");
  const { saveBankCredentials } = await import("@/server/db/queries/bank-credentials");
  const db = getDb();
  saveBankCredentials(
    1,
    "hapoalim",
    { userCode: "1234567", password: SECRET_PASSWORD },
    { label: "My account" },
  );
  const runId = Number(
    db
      .prepare(
        `INSERT INTO sync_runs (workspace_id, provider, started_at, status, scrape_from_date, error_message)
         VALUES (1, 'hapoalim', datetime('now'), 'failed', '2026-01-01', ?)`,
      )
      .run(`login failed with ${SECRET_PASSWORD} for user 1234567`).lastInsertRowid,
  );
  db.prepare(
    `INSERT INTO transactions (workspace_id, account_number, date, processed_date, original_amount,
       original_currency, charged_amount, charged_currency, description, type, status, provider,
       sync_run_id, dedup_hash)
     VALUES (1, '1234', '2026-11-01', '2026-11-01', 10, 'ILS', 10, 'ILS', ?, 'normal', 'completed',
       'hapoalim', ?, 'privacy-test-dedup')`,
  ).run(SECRET_MERCHANT, runId);
});

const text = async (res: Response) => await res.text();

describe("support diagnostics", () => {
  it("never carries credentials, merchants, amounts or card numbers", async () => {
    const { GET } = await import("@/app/api/diagnostics/route");
    const body = await text(await GET());
    expect(body).not.toContain(SECRET_PASSWORD);
    expect(body).not.toContain(SECRET_MERCHANT);
    expect(body).not.toContain("1234567");
    // Sync errors pass through redaction, which scrubs the credential echo.
    expect(body).toContain("[redacted]");
    const keys = Object.keys(JSON.parse(body) as Record<string, unknown>);
    expect(keys).toEqual(
      expect.arrayContaining([
        "app",
        "system",
        "database",
        "features",
        "data",
        "connections",
        "recentSyncs",
      ]),
    );
  });
});

describe("connected accounts", () => {
  it("returns metadata only, never the encrypted blob or its parts", async () => {
    const { GET } = await import("@/app/api/integrations/route");
    const body = await text(
      await GET(
        new Request("http://localhost/api/integrations", { headers: { "x-workspace-id": "1" } }),
      ),
    );
    expect(body).not.toContain(SECRET_PASSWORD);
    for (const forbidden of ["credentials", "encrypted", "auth_tag", "authTag", "iv", "password"]) {
      expect(body, forbidden).not.toContain(forbidden);
    }
    const rows = JSON.parse(body) as Record<string, unknown>[];
    expect(rows.length).toBe(1);
    expect(Object.keys(rows[0]).sort()).toEqual(
      [
        "createdAt",
        "hasTwoFactorToken",
        "id",
        "label",
        "lastSyncAt",
        "provider",
        "requiresManualTwoFactor",
        "transactionCount",
        "updatedAt",
      ].sort(),
    );
  });
});

describe("exports", () => {
  it("export transactions without any credential material", async () => {
    const { GET } = await import("@/app/api/data/export/route");
    const body = await text(
      await GET(
        new Request("http://localhost/api/data/export", { headers: { "x-workspace-id": "1" } }),
      ),
    );
    expect(body).toContain(SECRET_MERCHANT); // the transaction itself is the point of an export
    expect(body).not.toContain(SECRET_PASSWORD);
    for (const forbidden of ["password", "credentials", "auth_tag", "encryption"]) {
      expect(body.toLowerCase(), forbidden).not.toContain(forbidden);
    }
  });
});

describe("redaction", () => {
  it("removes keys, tokens, emails and long numbers from text bound for logs or AI", async () => {
    const { redact, redactError } = await import("@/server/lib/redact");
    const out = redact(
      `password=${SECRET_PASSWORD} userCode=1234567 token=abcdef apiKey="sk-abcdefghijklmnopqrstu" mail=a@b.co card=1234 5678 9012 3456`,
    );
    expect(out).not.toContain(SECRET_PASSWORD);
    expect(out).not.toContain("1234567");
    expect(out).not.toContain("sk-abcdefghijklmnopqrstu");
    expect(out).not.toContain("a@b.co");
    expect(out).not.toContain("1234 5678 9012 3456");
    expect(redactError(new Error("stack")).includes("\n")).toBe(false);
    // A value the app already stores is scrubbed verbatim, key or no key.
    const { redactKnownSecrets } = await import("@/server/lib/redact");
    expect(redactKnownSecrets(`login failed: ${SECRET_PASSWORD}`, [SECRET_PASSWORD])).toBe(
      "login failed: [redacted]",
    );
    expect(redactKnownSecrets("nothing stored here", [SECRET_PASSWORD])).toBe(
      "nothing stored here",
    );
  });
});

describe("logging", () => {
  it("never logs a raw password, credential or token variable", () => {
    const roots = ["src/server", "src/app/api"];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir)) {
        const p = path.join(dir, entry);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(entry)) files.push(p);
      }
    };
    roots.forEach(walk);
    const offenders: string[] = [];
    for (const file of files) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!/console\.(log|error|warn|debug|info)\(/.test(line)) return;
        // `redact(...)` and boolean flags are fine; interpolating a secret is not.
        if (/redact|Redact|hasToken|masked/.test(line)) return;
        if (
          /(password|credentials|apiKey|secret|token)\b/i.test(line) &&
          /\$\{|,\s*\w*(password|credentials|apiKey|secret|token)/i.test(line)
        ) {
          offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
