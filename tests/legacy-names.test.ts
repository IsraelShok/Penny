import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pennyEnv, readStored } from "@/lib/legacy-names";
import { dataDir, dbPath } from "@/server/lib/data-dir";

describe("pennyEnv", () => {
  it("prefers the PENNY_ name", () => {
    expect(pennyEnv("DATA_DIR", { PENNY_DATA_DIR: "/new", SPENT_DATA_DIR: "/old" })).toBe("/new");
  });
  it("falls back to the pre-rename name", () => {
    expect(pennyEnv("DATA_DIR", { SPENT_DATA_DIR: "/old" })).toBe("/old");
    expect(pennyEnv("DATA_DIR", {})).toBeUndefined();
  });
});

describe("dataDir", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("reads the old variable when only it is set", () => {
    vi.stubEnv("PENNY_DATA_DIR", undefined as unknown as string);
    vi.stubEnv("SPENT_DATA_DIR", "/old-data");
    expect(dataDir()).toBe(path.resolve("/old-data"));
  });
});

describe("dbPath", () => {
  const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), "penny-names-"));
  it("uses penny.db on a fresh install", () => {
    const d = dir();
    expect(dbPath(d)).toBe(path.join(d, "penny.db"));
  });
  it("renames the old database and its WAL files when only it exists", () => {
    const d = dir();
    fs.writeFileSync(path.join(d, "spent.db"), "main");
    fs.writeFileSync(path.join(d, "spent.db-wal"), "wal");
    expect(dbPath(d)).toBe(path.join(d, "penny.db"));
    expect(fs.readFileSync(path.join(d, "penny.db"), "utf8")).toBe("main");
    expect(fs.readFileSync(path.join(d, "penny.db-wal"), "utf8")).toBe("wal");
    expect(fs.existsSync(path.join(d, "spent.db"))).toBe(false);
    expect(fs.existsSync(path.join(d, "penny.db-shm"))).toBe(false);
  });
  it("prefers penny.db when both exist", () => {
    const d = dir();
    fs.writeFileSync(path.join(d, "spent.db"), "");
    fs.writeFileSync(path.join(d, "penny.db"), "");
    expect(dbPath(d)).toBe(path.join(d, "penny.db"));
  });
});

describe("readStored", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (data: Record<string, string>) =>
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => data[k] ?? null } });
  it("prefers the new key", () => {
    stub({ "penny.k": "new", "spent.k": "old" });
    expect(readStored("penny.k", "spent.k")).toBe("new");
  });
  it("falls back to the old key", () => {
    stub({ "spent.k": "old" });
    expect(readStored("penny.k", "spent.k")).toBe("old");
  });
});
