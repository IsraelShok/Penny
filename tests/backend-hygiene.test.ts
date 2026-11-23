import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import Database from "better-sqlite3";
const holder = vi.hoisted(() => ({ db: null as unknown as Database.Database }));
vi.mock("@/server/db", () => ({ getDb: () => holder.db }));
import { runMigrations } from "@/server/db/migrate";
import {
  getCategorySpendInRange,
  getMonthlySummary,
  getPeriodTotal,
  insertTransactions,
} from "@/server/db/queries/transactions";
import { getHistoricalTrend } from "@/server/db/queries/home";
import { deleteCategory } from "@/server/db/queries/categories";
import { israelNoon, israelToday, utcDay } from "@/lib/dates";
import { roundSums } from "@/lib/money";

const addTxn = (id: number, date: string, amount: number, extra = "") =>
  holder.db.exec(
    `INSERT INTO transactions(id,workspace_id,account_number,date,processed_date,original_amount,original_currency,charged_amount,description,type,status,provider,sync_run_id,dedup_hash,kind${extra ? ",category_id" : ""})
     VALUES (${id},1,'1','${date}','${date}',${amount},'ILS',${amount},'x','normal','completed','manual',1,'h${id}','expense'${extra})`,
  );

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
});
afterEach(() => {
  vi.useRealTimers();
  holder.db.close();
});

describe("one definition of today", () => {
  it("is Israel's calendar day, not the UTC or host day", () => {
    // 22:30 UTC on the 23rd is 00:30 on the 24th in Israel.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-23T22:30:00Z"));
    expect(israelToday()).toBe("2026-11-24");
    const noon = israelNoon();
    expect([noon.getFullYear(), noon.getMonth() + 1, noon.getDate()]).toEqual([2026, 11, 24]);

    addTxn(1, "2026-11-23", -10);
    addTxn(2, "2026-11-24", -20);
    // "From today": the UTC day (the 23rd) would also count yesterday's 10.
    expect(getMonthlySummary(1, 0)).toEqual([{ month: "2026-11", amount: 20 }]);
  });

  it("rolls the month over with Israel, not with the host", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-30T22:30:00Z"));
    const trend = getHistoricalTrend(1, 1);
    expect(trend).toMatchObject([{ month: "2026-12", isCurrent: true }]);
  });

  it("utcDay is the UTC calendar day of an instant", () => {
    expect(utcDay(new Date("2026-11-23T22:30:00Z"))).toBe("2026-11-23");
  });
});

describe("money sums", () => {
  it("rounds SQL sums to agorot where they are read", () => {
    addTxn(1, "2026-03-01", -0.1, ",901");
    addTxn(2, "2026-03-02", -0.2, ",901");
    const raw = holder.db.prepare("SELECT SUM(-charged_amount) AS s FROM transactions").get() as {
      s: number;
    };
    expect(raw.s).not.toBe(0.3); // the fixture really drifts: 0.30000000000000004
    expect(getPeriodTotal(1, "2026-03-01", "2026-03-31")).toBe(0.3);
    expect(getCategorySpendInRange(1, "2026-03-01", "2026-03-31")).toMatchObject([
      { categoryId: 901, amount: 0.3 },
    ]);
  });

  it("roundSums leaves nulls and other fields alone", () => {
    expect(roundSums({ a: 0.1 + 0.2, b: null as number | null, n: 3 }, "a", "b")).toEqual({
      a: 0.3,
      b: null,
      n: 3,
    });
    expect(roundSums([{ a: 1.005 }], "a")).toEqual([{ a: 1.01 }]);
  });

  it("matches an imported row by a rounded amount", () => {
    holder.db.pragma("foreign_keys = OFF"); // no bank_credentials row needed for credential 1
    holder.db.exec(
      `INSERT INTO transactions(id,workspace_id,account_number,date,processed_date,original_amount,original_currency,charged_amount,description,type,status,provider,sync_run_id,dedup_hash,kind)
       VALUES (7,1,'1','2026-03-05','2026-03-05',-0.3,'ILS',-0.3,'from file','normal','completed','file',1,'f7','expense')`,
    );
    insertTransactions(
      1,
      [
        {
          accountNumber: "1",
          date: "2026-03-05",
          processedDate: "2026-03-05",
          originalAmount: -(0.1 + 0.2),
          originalCurrency: "ILS",
          chargedAmount: -(0.1 + 0.2),
          description: "from bank",
          type: "normal",
          status: "completed",
        },
      ] as Parameters<typeof insertTransactions>[1],
      "hapoalim",
      1,
      1,
    );
    // The bank row adopted the file row instead of being stored next to it.
    const rows = holder.db.prepare("SELECT id, description FROM transactions").all();
    expect(rows).toEqual([{ id: 7, description: "from bank" }]);
  });
});

describe("deleteCategory", () => {
  it("deletes no budget for a category id of another workspace", () => {
    holder.db.exec(
      "INSERT INTO budgets(workspace_id,category_id,monthly_amount) VALUES (2,902,500)",
    );
    expect(deleteCategory(1, 902)).toMatchObject({ ok: false });
    const n = () =>
      (holder.db.prepare("SELECT COUNT(*) AS n FROM budgets").get() as { n: number }).n;
    expect(n()).toBe(1);
    // The statement itself is scoped too, not only the lookup before it.
    holder.db.exec(
      "INSERT INTO budgets(workspace_id,category_id,monthly_amount) VALUES (1,901,100)",
    );
    expect(deleteCategory(1, 901)).toMatchObject({ ok: true });
    expect(n()).toBe(1);
  });
});
