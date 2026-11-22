import { beforeEach, afterEach, it, expect, vi } from "vitest";
import Database from "better-sqlite3";
const holder = vi.hoisted(() => ({ db: null as unknown as Database.Database }));
vi.mock("@/server/db", () => ({ getDb: () => holder.db }));
import { runMigrations } from "@/server/db/migrate";
import { updateTransactionCategory, batchUpdateCategories } from "@/server/db/queries/transactions";

beforeEach(() => {
  holder.db = new Database(":memory:");
  runMigrations(holder.db);
  holder.db.exec("INSERT INTO workspaces(id,name,slug) VALUES (2,'Other','other')");
  holder.db.exec(
    "INSERT INTO sync_runs(id,workspace_id,provider,status,scrape_from_date,started_at) VALUES (1,1,'manual','completed','2026-01-01','2026-01-01')",
  );
  holder.db.exec(
    "INSERT INTO categories(id,workspace_id,name,kind,color) VALUES (901,1,'Mine','expense','#111111'),(902,2,'Theirs','expense','#222222')",
  );
  holder.db.exec(
    "INSERT INTO transactions(id,workspace_id,account_number,date,processed_date,original_amount,original_currency,charged_amount,description,type,status,provider,sync_run_id,dedup_hash,kind) VALUES (1,1,'1','2026-01-01','2026-01-01',-10,'ILS',-10,'x','normal','completed','manual',1,'h1','expense')",
  );
});
afterEach(() => holder.db.close());

const cat = () =>
  (
    holder.db.prepare("SELECT category_id AS c FROM transactions WHERE id=1").get() as {
      c: number | null;
    }
  ).c;

it("never points a transaction at another workspace's category", () => {
  updateTransactionCategory(1, 1, 902, "user");
  expect(cat()).not.toBe(902);
  batchUpdateCategories(1, [{ id: 1, categoryId: 902 }]);
  expect(cat()).not.toBe(902);
  updateTransactionCategory(1, 1, 901, "user");
  expect(cat()).toBe(901);
});
