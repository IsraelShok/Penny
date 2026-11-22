import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("@/server/db/queries/settings", () => ({
  getGlobalSetting: () => null,
  setGlobalSetting: () => {},
}));
vi.mock("@/server/db/queries/transactions", () => ({}));
vi.mock("@/server/db/queries/excluded-merchants", () => ({}));
vi.mock("@/server/db/queries/rules", () => ({}));
vi.mock("@/server/db", () => ({}));
vi.mock("@/server/lib/encryption", () => ({ isKeyLocked: () => false }));

import {
  accountForFolder,
  folderNameFor,
  isImportable,
  moveInto,
  pickStableFiles,
} from "@/server/lib/folder-import";
import { statementRows } from "@/lib/file-import";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "folder-import-"));

describe("folder import files", () => {
  it("accepts statement types and ignores temp/partial downloads", () => {
    expect(["a.csv", "B.XLSX", "c.xls"].every(isImportable)).toBe(true);
    expect(
      ["~$a.xlsx", "a.csv.crdownload", "a.part", ".hidden.csv", "a.pdf", "a.txt"].some(
        isImportable,
      ),
    ).toBe(false);
  });

  it("only returns files unchanged since the previous scan", () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, "a.csv"), "x");
    fs.writeFileSync(path.join(dir, "empty.csv"), "");
    fs.mkdirSync(path.join(dir, "imported"));
    fs.writeFileSync(path.join(dir, "imported", "old.csv"), "x");
    const first = pickStableFiles(dir, {});
    expect(first.ready).toEqual([]);
    expect(Object.keys(first.seen).sort()).toEqual(["a.csv", "empty.csv"]);
    expect(pickStableFiles(dir, first.seen).ready).toEqual(["a.csv"]); // empty file never ready
    fs.appendFileSync(path.join(dir, "a.csv"), "more");
    expect(pickStableFiles(dir, first.seen).ready).toEqual([]);
  });

  it("moves without overwriting and writes an error note", () => {
    const dir = tmp();
    for (const n of [1, 2]) {
      fs.writeFileSync(path.join(dir, "s.csv"), String(n));
      moveInto(dir, "s.csv", "imported");
    }
    expect(fs.readdirSync(path.join(dir, "imported")).sort()).toEqual(["s (2).csv", "s.csv"]);
    fs.writeFileSync(path.join(dir, "bad.csv"), "x");
    const dest = moveInto(dir, "bad.csv", "failed", "noHeader");
    expect(fs.readFileSync(`${dest}.error.txt`, "utf8")).toBe("noHeader");
    expect(fs.existsSync(path.join(dir, "bad.csv"))).toBe(false);
  });

  it("parses a CSV statement end to end", async () => {
    const csv = "תאריך,תיאור,חובה,זכות\n01/02/2024,קפה,12.5,\n02/02/2024,משכורת,,1000\n";
    const { rows } = await statementRows(new TextEncoder().encode(csv), "s.csv");
    expect(rows).toEqual([
      { date: "2024-02-01", description: "קפה", amount: -12.5 },
      { date: "2024-02-02", description: "משכורת", amount: 1000 },
    ]);
  });
});

describe("account subfolders", () => {
  it("names a folder per account and reads the account back", () => {
    const name = folderNameFor({
      accountNumber: "1234",
      label: "Max: family/card",
      provider: "max",
    });
    expect(name).toBe("Max- family-card (1234)");
    expect(accountForFolder(name)).toBe("1234");
    expect(accountForFolder("Altshuler pension")).toBe("Altshuler pension");
  });
});
