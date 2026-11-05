import "server-only";

import { getDb } from "../index";
import { LIABILITY_TYPES, type AssetInput, type AssetType } from "@/lib/types";

export interface AssetRow extends AssetInput {
  id: number;
  isLiability: boolean;
}

const COLUMNS = `id, name, type, currency, symbol, quantity, manual_value as manualValue,
  cost_basis as costBasis, liquid, is_liability as isLiability, note`;

const isLiabilityType = (t: AssetType) => (LIABILITY_TYPES as readonly string[]).includes(t);

export function listAssets(workspaceId: number): AssetRow[] {
  const rows = getDb()
    .prepare(`SELECT ${COLUMNS} FROM assets WHERE workspace_id = ? ORDER BY is_liability, name`)
    .all(workspaceId) as (Omit<AssetRow, "liquid" | "isLiability"> & { liquid: number; isLiability: number })[];
  return rows.map((r) => ({ ...r, liquid: r.liquid === 1, isLiability: r.isLiability === 1 }));
}

export function createAssets(workspaceId: number, inputs: AssetInput[]): number {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO assets (workspace_id, name, type, currency, symbol, quantity, manual_value, cost_basis, liquid, is_liability, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  db.transaction(() => {
    for (const a of inputs) {
      stmt.run(workspaceId, a.name, a.type, a.currency, a.symbol, a.quantity, a.manualValue, a.costBasis, a.liquid ? 1 : 0, isLiabilityType(a.type) ? 1 : 0, a.note);
    }
  })();
  return inputs.length;
}

export function updateAsset(workspaceId: number, id: number, a: AssetInput): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE assets SET name = ?, type = ?, currency = ?, symbol = ?, quantity = ?, manual_value = ?,
           cost_basis = ?, liquid = ?, is_liability = ?, note = ?
         WHERE workspace_id = ? AND id = ?`
      )
      .run(a.name, a.type, a.currency, a.symbol, a.quantity, a.manualValue, a.costBasis, a.liquid ? 1 : 0, isLiabilityType(a.type) ? 1 : 0, a.note, workspaceId, id)
      .changes > 0
  );
}

export function deleteAsset(workspaceId: number, id: number): boolean {
  return getDb().prepare("DELETE FROM assets WHERE workspace_id = ? AND id = ?").run(workspaceId, id).changes > 0;
}

export function saveSnapshots(date: string, values: { assetId: number; valueIls: number }[]) {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO asset_snapshots (asset_id, date, value_ils) VALUES (?, ?, ?) ON CONFLICT(asset_id, date) DO UPDATE SET value_ils = excluded.value_ils"
  );
  db.transaction(() => values.forEach((v) => stmt.run(v.assetId, date, v.valueIls)))();
}

/** Net worth per snapshot date: assets minus liabilities, carrying each asset's last known value forward. */
export function netWorthHistory(workspaceId: number): { date: string; netWorth: number }[] {
  const rows = getDb()
    .prepare(
      `SELECT s.date, s.asset_id as assetId, s.value_ils as value, a.is_liability as isLiability
       FROM asset_snapshots s JOIN assets a ON a.id = s.asset_id
       WHERE a.workspace_id = ? ORDER BY s.date`
    )
    .all(workspaceId) as { date: string; assetId: number; value: number; isLiability: number }[];
  const latest = new Map<number, number>();
  const out: { date: string; netWorth: number }[] = [];
  for (const r of rows) {
    latest.set(r.assetId, r.isLiability ? -r.value : r.value);
    const total = [...latest.values()].reduce((s, v) => s + v, 0);
    if (out.at(-1)?.date === r.date) out[out.length - 1].netWorth = total;
    else out.push({ date: r.date, netWorth: total });
  }
  return out;
}
