import "server-only";

import { getDb } from "@/server/db";
import { encrypt, decrypt } from "@/server/lib/encryption";
import { registerOtpRequest } from "@/server/sync/otp-bridge";
import { assetKey, savingsType, type PensionFund } from "@/lib/pension";

interface Row {
  id: number;
  fund_id: PensionFund;
  credentials_encrypted: Buffer;
  iv: Buffer;
  auth_tag: Buffer;
  session_encrypted: Buffer | null;
  session_iv: Buffer | null;
  session_auth_tag: Buffer | null;
}

export type PensionState = {
  state: "idle" | "running" | "otp" | "done" | "error";
  message?: string;
};

// shortcut: in-memory status, like the OTP bridge; fine for this single-process local app.
const status = new Map<number, PensionState>();
const pensionStatus = (id: number): PensionState => status.get(id) ?? { state: "idle" };

/** OTP bridge keys are sync-run ids; pension syncs use the negative connection id so they never collide. */
export const otpKey = (connectionId: number) => -connectionId;

export function savePensionConnection(
  workspaceId: number,
  fundId: PensionFund,
  credentials: { id: string; phone?: string },
) {
  const e = encrypt(JSON.stringify(credentials));
  return getDb()
    .prepare(
      `INSERT INTO pension_connections (workspace_id, fund_id, credentials_encrypted, iv, auth_tag) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id, fund_id) DO UPDATE SET credentials_encrypted = excluded.credentials_encrypted, iv = excluded.iv, auth_tag = excluded.auth_tag,
         session_encrypted = NULL, session_iv = NULL, session_auth_tag = NULL
       RETURNING id`,
    )
    .get(workspaceId, fundId, e.encrypted, e.iv, e.authTag) as { id: number };
}

export function listPensionConnections(workspaceId: number) {
  return (
    getDb()
      .prepare(
        `SELECT id, fund_id as fundId, last_sync_at as lastSyncAt, last_error as lastError FROM pension_connections WHERE workspace_id = ?`,
      )
      .all(workspaceId) as {
      id: number;
      fundId: PensionFund;
      lastSyncAt: string | null;
      lastError: string | null;
    }[]
  ).map((c) => ({ ...c, ...pensionStatus(c.id) }));
}

export function deletePensionConnection(workspaceId: number, id: number) {
  getDb()
    .prepare(`DELETE FROM pension_connections WHERE id = ? AND workspace_id = ?`)
    .run(id, workspaceId);
  status.delete(id);
}

/** Starts a sync in the background; progress and the OTP prompt are read through pensionStatus(). */
export function startPensionSync(workspaceId: number, id: number): boolean {
  const row = getDb()
    .prepare(`SELECT * FROM pension_connections WHERE id = ? AND workspace_id = ?`)
    .get(id, workspaceId) as Row | undefined;
  const now = status.get(id)?.state;
  if (!row || now === "running" || now === "otp") return false;
  status.set(id, { state: "running" });
  void run(workspaceId, row).catch((err) =>
    fail(id, err instanceof Error ? err.message : String(err)),
  );
  return true;
}

function fail(id: number, message: string) {
  status.set(id, { state: "error", message });
  getDb().prepare(`UPDATE pension_connections SET last_error = ? WHERE id = ?`).run(message, id);
}

async function run(workspaceId: number, row: Row) {
  const db = getDb();
  const credentials = JSON.parse(
    decrypt({ encrypted: row.credentials_encrypted, iv: row.iv, authTag: row.auth_tag }),
  ) as { id: string; phone?: string };
  // Cookies stay encrypted in our DB instead of the library's default plain JSON file.
  const session = {
    async load() {
      const r = db
        .prepare(
          `SELECT session_encrypted, session_iv, session_auth_tag FROM pension_connections WHERE id = ?`,
        )
        .get(row.id) as Pick<Row, "session_encrypted" | "session_iv" | "session_auth_tag">;
      if (!r.session_encrypted || !r.session_iv || !r.session_auth_tag) return null;
      return JSON.parse(
        decrypt({ encrypted: r.session_encrypted, iv: r.session_iv, authTag: r.session_auth_tag }),
      ) as unknown[];
    },
    async save(_connectionId: string, cookies: unknown[]) {
      const e = encrypt(JSON.stringify(cookies));
      db.prepare(
        `UPDATE pension_connections SET session_encrypted = ?, session_iv = ?, session_auth_tag = ? WHERE id = ?`,
      ).run(e.encrypted, e.iv, e.authTag, row.id);
    },
  };
  const scrapeArgs = {
    fundId: row.fund_id,
    credentials,
    connectionId: String(row.id),
    session,
    onProgress: (message: string) => status.set(row.id, { state: "running", message }),
    onOtpNeeded: () => {
      status.set(row.id, { state: "otp" });
      return registerOtpRequest(otpKey(row.id), workspaceId, row.fund_id)
        .wait()
        .finally(() => status.set(row.id, { state: "running" }));
    },
  };
  const outcome =
    row.fund_id === "phoenix"
      ? await (await import("./custom-scrapers")).scrapeCustomPension(scrapeArgs)
      : await (await import("israeli-pension-scrapers")).scrapePension(scrapeArgs);
  if (!outcome.success)
    return fail(row.id, outcome.errorMessage ?? outcome.errorType ?? "Sync failed");

  // Each product becomes (or updates) an asset, matched by the key in its note.
  const find = db.prepare(`SELECT id FROM assets WHERE workspace_id = ? AND note = ?`);
  const update = db.prepare(
    `UPDATE assets SET manual_value = ?, name = ?,
       fee_deposit = COALESCE(?, fee_deposit),
       fee_balance = COALESCE(?, fee_balance),
       monthly_deposit = COALESCE(?, monthly_deposit),
       details = COALESCE(?, details)
     WHERE id = ?`,
  );
  const insert = db.prepare(
    `INSERT INTO assets (workspace_id, name, type, currency, manual_value, liquid, is_liability, note, fee_deposit, fee_balance, monthly_deposit, details)
     VALUES (?, ?, ?, 'ILS', ?, 0, 0, ?, ?, ?, ?, ?)`,
  );
  db.transaction(() => {
    for (const raw of outcome.accounts) {
      const a = raw as typeof raw & {
        feeDeposit?: number | null;
        feeBalance?: number | null;
        monthlyDeposit?: number | null;
        details?: Record<string, unknown>;
      };
      if (a.balance == null) continue;
      const key = assetKey(row.id, a.accountNumber);
      const name = a.label ?? a.accountNumber;
      const detailsJson = a.details ? JSON.stringify(a.details) : null;
      const existing = find.get(workspaceId, key) as { id: number } | undefined;
      if (existing) {
        update.run(
          a.balance,
          name,
          a.feeDeposit ?? null,
          a.feeBalance ?? null,
          a.monthlyDeposit ?? null,
          detailsJson,
          existing.id,
        );
      } else {
        insert.run(
          workspaceId,
          name,
          savingsType(name),
          a.balance,
          key,
          a.feeDeposit ?? null,
          a.feeBalance ?? null,
          a.monthlyDeposit ?? null,
          detailsJson,
        );
      }
    }
    db.prepare(
      `UPDATE pension_connections SET last_sync_at = datetime('now'), last_error = NULL WHERE id = ?`,
    ).run(row.id);
  })();
  status.set(row.id, { state: "done", message: String(outcome.accounts.length) });
}
