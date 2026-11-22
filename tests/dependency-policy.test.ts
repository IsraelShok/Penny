import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// SECURITY.md promises that the packages which touch credentials are pinned to exact
// versions. A caret or range there would let an unreviewed release run with the user's
// bank password or read the database file.
const CREDENTIAL_PACKAGES = [
  "israeli-bank-scrapers",
  "israeli-pension-scrapers",
  "@sergienko4/israeli-bank-scrapers",
  "better-sqlite3",
  "@anthropic-ai/sdk",
];

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

interface PackageJson {
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  allowScripts?: Record<string, boolean>;
}

const pkg = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
) as PackageJson;

describe("dependency policy", () => {
  it.each(CREDENTIAL_PACKAGES)("pins %s to an exact version", (name) => {
    const spec = pkg.dependencies[name];
    expect(spec, `${name} must stay a runtime dependency`).toBeDefined();
    expect(spec).toMatch(EXACT_VERSION);
  });

  it("keeps install scripts off for the native database build", () => {
    expect(pkg.allowScripts?.["better-sqlite3"]).toBe(false);
  });

  it("keeps the critical-advisory gate wired for CI", () => {
    expect(pkg.scripts["security:audit:gate"]).toContain("--audit-level=critical");
  });
});
