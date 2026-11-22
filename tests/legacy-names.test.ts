import path from "path";
import { describe, expect, it } from "vitest";
import { pennyEnv } from "@/lib/legacy-names";
import { dbPath } from "@/server/lib/data-dir";

describe("pennyEnv", () => {
  it("reads the PENNY_ name", () => {
    expect(pennyEnv("DATA_DIR", { PENNY_DATA_DIR: "/new" })).toBe("/new");
    expect(pennyEnv("DATA_DIR", {})).toBeUndefined();
  });
});

describe("dbPath", () => {
  it("is penny.db in the data dir", () => {
    expect(dbPath("/d")).toBe(path.join("/d", "penny.db"));
  });
});
