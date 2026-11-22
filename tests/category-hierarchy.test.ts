import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";
import { runMigrations } from "@/server/db/migrate";
import { applyCategoryHierarchy, CATEGORY_PARENTS } from "@/server/db/category-hierarchy";
import { buildPickerSections, hueOf } from "@/lib/category-tree";
import type { Category } from "@/lib/types";

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-cathier-"));
  const db = new Database(path.join(dir, "penny.db"));
  runMigrations(db);
  return { db, dir };
}
const parentName = (db: Database.Database, child: string) =>
  (
    db
      .prepare(
        "SELECT p.name FROM categories c LEFT JOIN categories p ON p.id = c.parent_id WHERE c.workspace_id = 1 AND c.name = ?",
      )
      .get(child) as { name: string | null } | undefined
  )?.name;

describe("category hierarchy migration", () => {
  it("builds two levels on a fresh install", () => {
    const { db } = freshDb();
    for (const p of CATEGORY_PARENTS) expect(parentName(db, p.name)).toBeNull();
    expect(parentName(db, "Groceries")).toBe("Food");
    expect(parentName(db, "Bakery")).toBe("Food");
    expect(parentName(db, "Car Insurance")).toBe("Transportation");
    expect(parentName(db, "Salary")).toBe("Income Sources");
    // never deeper than two levels
    expect(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM categories c JOIN categories p ON p.id = c.parent_id WHERE p.parent_id IS NOT NULL",
          )
          .get() as { n: number }
      ).n,
    ).toBe(0);
  });

  it("is non-destructive on an existing install: backup, ids kept, user categories untouched, Hebrew duplicates skipped", () => {
    const { db, dir } = freshDb();
    // Pretend 048 has not run yet, with a user's own data in place.
    db.exec("DELETE FROM _migrations WHERE name = '048_category_hierarchy.sql'");
    db.exec("DELETE FROM categories WHERE name IN ('Bakery','Taxis','Kids & Education')");
    db.prepare("UPDATE categories SET parent_id = NULL WHERE name = 'Education'").run();
    db.prepare(
      "INSERT INTO categories (workspace_id, name, color, kind) VALUES (1, 'מוניות', '#000', 'expense'), (1, 'My Stuff', '#111', 'expense')",
    ).run();
    const groceries = (
      db
        .prepare("SELECT id FROM categories WHERE workspace_id = 1 AND name = 'Groceries'")
        .get() as { id: number }
    ).id;
    const before = (db.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number }).n;

    runMigrations(db);

    expect(fs.readdirSync(dir).filter((f) => f.endsWith(".bak"))).toHaveLength(1);
    expect(
      (
        db
          .prepare("SELECT id FROM categories WHERE workspace_id = 1 AND name = 'Groceries'")
          .get() as { id: number }
      ).id,
    ).toBe(groceries);
    expect(parentName(db, "Education")).toBe("Kids & Education");
    expect(parentName(db, "Bakery")).toBe("Food");
    expect(db.prepare("SELECT 1 FROM categories WHERE name = 'Taxis'").get()).toBeUndefined(); // Hebrew name already there
    expect(parentName(db, "My Stuff")).toBeNull();
    const after = (db.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number }).n;
    expect(after).toBe(before + 2); // Bakery + Kids & Education
    applyCategoryHierarchy(db);
    expect((db.prepare("SELECT COUNT(*) AS n FROM categories").get() as { n: number }).n).toBe(
      after,
    );
  });
});

const cat = (id: number, name: string, color: string, parentId: number | null = null) =>
  ({ id, name, color, parentId, kind: "expense" }) as Category;

describe("category picker sections", () => {
  const cats = [
    cat(1, "מזון", "#E7A875"),
    cat(2, "סופרמרקט", "#81B482", 1),
    cat(3, "מסעדות", "#E89B80", 1),
    cat(4, "תחבורה", "#7D90CA"),
    cat(5, "דלק", "#65C1D1", 4),
    cat(6, "אחר שלי", "#A2ABBB"),
  ];
  const label = (c: Category) => c.name;

  it("groups leaves under parents, Hebrew order, loose ones last; parents not selectable", () => {
    const s = buildPickerSections(cats, "groups", "", label);
    expect(s.map((x) => x.title)).toEqual(["מזון", "תחבורה", undefined]);
    expect(s[0].items.map((c) => c.name)).toEqual(["מסעדות", "סופרמרקט"]);
    expect(s.flatMap((x) => x.items).some((c) => c.id === 1 || c.id === 4)).toBe(false);
  });

  it("searching a parent shows its children", () => {
    expect(
      buildPickerSections(cats, "groups", "תחבו", label).flatMap((x) => x.items.map((c) => c.name)),
    ).toEqual(["דלק"]);
  });

  it("sorts A-Z with Hebrew collation and by color with grays last", () => {
    expect(buildPickerSections(cats, "az", "", label)[0].items.map((c) => c.name)).toEqual([
      "אחר שלי",
      "דלק",
      "מסעדות",
      "סופרמרקט",
    ]);
    const color = buildPickerSections(cats, "color", "", label);
    expect(color.at(-1)!.items.map((c) => c.name)).toEqual(["אחר שלי"]);
    expect(hueOf("#A2ABBB")).toBe(-1);
    expect(hueOf("#ff0000")).toBe(0);
  });
});
