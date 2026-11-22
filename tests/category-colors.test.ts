import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";
import { childColor, familySwatches, hexToOklch } from "@/lib/category-colors";
import { runMigrations } from "@/server/db/migrate";
import { applyFamilyColors } from "@/server/db/category-colors";
import { CATEGORY_PARENTS } from "@/server/db/category-hierarchy";

const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

describe("color family derivation", () => {
  it("keeps the parent's hue, varies lightness, and is deterministic", () => {
    for (const p of CATEGORY_PARENTS) {
      const parent = hexToOklch(p.color);
      const kids = familySwatches(p.color, 12);
      expect(new Set(kids).size).toBe(12); // siblings distinguishable
      expect(childColor(p.color, 3)).toBe(kids[3]);
      for (const hex of kids) {
        expect(hex).toMatch(/^#[0-9A-F]{6}$/);
        const k = hexToOklch(hex);
        expect(k.l).toBeGreaterThan(0.58);
        expect(k.l).toBeLessThan(0.86);
        if (parent.c > 0.05) expect(hueGap(k.h, parent.h)).toBeLessThan(18);
      }
    }
  });

  it("gives every colored group its own hue", () => {
    const hues = CATEGORY_PARENTS.map((p) => hexToOklch(p.color))
      .filter((o) => o.c > 0.05)
      .map((o) => o.h);
    for (let i = 0; i < hues.length; i++)
      for (let j = i + 1; j < hues.length; j++)
        expect(hueGap(hues[i], hues[j])).toBeGreaterThanOrEqual(20);
  });
});

describe("family colors migration", () => {
  const color = (db: Database.Database, name: string) =>
    (
      db.prepare("SELECT color FROM categories WHERE workspace_id = 1 AND name = ?").get(name) as {
        color: string;
      }
    ).color;

  it("recolors seeded defaults only and leaves user-chosen colors untouched", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-catcolor-"));
    const db = new Database(path.join(dir, "penny.db"));
    runMigrations(db);
    const food = CATEGORY_PARENTS.find((p) => p.name === "Food")!.color;
    expect(color(db, "Food")).toBe(food);
    expect(hueGap(hexToOklch(color(db, "Groceries")).h, hexToOklch(food).h)).toBeLessThan(18);

    // Back to the pre-050 state: seeded colors, plus a user-picked leaf and group.
    db.exec("DELETE FROM _migrations WHERE name = '050_category_family_colors.sql'");
    db.exec("UPDATE categories SET color = '#E7A875' WHERE name = 'Food'");
    db.exec("UPDATE categories SET color = '#81B482' WHERE name = 'Groceries'");
    db.exec("UPDATE categories SET color = '#123456' WHERE name = 'Restaurants'");
    db.exec("UPDATE categories SET color = '#3366CC' WHERE name = 'Transportation'");
    db.exec("UPDATE categories SET color = '#65C1D1' WHERE name = 'Fuel'");
    db.prepare(
      "INSERT INTO categories (workspace_id, parent_id, name, color, kind) VALUES (1, (SELECT id FROM categories WHERE workspace_id = 1 AND name = 'Food'), 'My Snacks', '#81B482', 'expense')",
    ).run();

    runMigrations(db);

    expect(fs.readdirSync(dir).filter((f) => f.endsWith(".bak"))).toHaveLength(1);
    expect(color(db, "Food")).toBe(food);
    expect(color(db, "Groceries")).not.toBe("#81B482");
    expect(color(db, "Restaurants")).toBe("#123456"); // user's pick
    expect(color(db, "My Snacks")).toBe("#81B482"); // user's own category
    expect(color(db, "Transportation")).toBe("#3366CC"); // user's group color kept...
    expect(hueGap(hexToOklch(color(db, "Fuel")).h, hexToOklch("#3366CC").h)).toBeLessThan(18); // ...and its children follow it

    const snapshot = db.prepare("SELECT id, color FROM categories ORDER BY id").all();
    applyFamilyColors(db);
    expect(db.prepare("SELECT id, color FROM categories ORDER BY id").all()).toEqual(snapshot); // idempotent
  });

  it("051 lifts 050's gray-looking pastels to the saturated families, keeping user picks", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-catcolor-"));
    const db = new Database(path.join(dir, "penny.db"));
    runMigrations(db);
    // Back to the 050 state: pastel Food family, plus one user-picked leaf.
    db.exec("DELETE FROM _migrations WHERE name = '051_category_colors_saturated.sql'");
    db.exec("UPDATE categories SET color = '#E99C70' WHERE name = 'Food'");
    db.prepare("UPDATE categories SET color = ? WHERE name = 'Groceries'").run(
      childColor("#E99C70", 0),
    );
    db.exec("UPDATE categories SET color = '#123456' WHERE name = 'Restaurants'");
    runMigrations(db);
    const food = CATEGORY_PARENTS.find((p) => p.name === "Food")!.color;
    expect(color(db, "Food")).toBe(food);
    expect(hexToOklch(color(db, "Groceries")).c).toBeGreaterThan(0.13);
    expect(color(db, "Restaurants")).toBe("#123456");
  });
});
