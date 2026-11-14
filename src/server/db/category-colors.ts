import type Database from "better-sqlite3";
import { childColor } from "@/lib/category-colors";
import { CATEGORY_PARENTS, NEW_LEAVES } from "./category-hierarchy";
import { SEED_CATEGORIES } from "./queries/workspaces";

/** Migration that runs applyFamilyColors on existing installs. */
export const FAMILY_COLORS_MIGRATION = "050_category_family_colors.sql";
/** Re-applies the families with more saturated hues; 050's pastels read as gray. */
export const SATURATED_COLORS_MIGRATION = "051_category_colors_saturated.sql";

/** Group colors 050 seeded (L 0.76, C 0.11). Their child shades are recognised as defaults too. */
const PASTEL_PARENT_COLORS: Record<string, string> = {
  "Home & Bills": "#DAA75D", Food: "#E99C70", Transportation: "#60BDEB", "Health & Family": "#47C5D1",
  "Kids & Education": "#C1B35B", "Leisure & Fun": "#B0A5F2", "Clothing & Grooming": "#CB9CE2", Insurances: "#EF9494",
  "Telecom & Subscriptions": "#8BB1F7", Pets: "#57C8AE", "Gifts & Giving": "#EA93B1", "Savings & Investing": "#7CC58C",
  Lifestyle: "#DD96CC", "Income Sources": "#9DBF71",
};

/** Group colors seeded by 017/048 before each group got its own hue. */
const LEGACY_PARENT_COLORS: Record<string, string> = {
  "Home & Bills": "#A4C386", Food: "#E7A875", Transportation: "#7D90CA", "Health & Family": "#65C1D1",
  "Kids & Education": "#E5D080", "Leisure & Fun": "#E499A4", "Clothing & Grooming": "#D5A4D7", Insurances: "#E59A99",
  "Telecom & Subscriptions": "#9186D1", Pets: "#6EBFB5", "Gifts & Giving": "#D67BAA", "Money Movement": "#A2ABBB",
  "Savings & Investing": "#81B482", Lifestyle: "#D692BF", "Income Sources": "#85B59A",
};

/** Every color the app itself ever seeded per built-in name. A color outside this list was picked by the user. */
function seededDefaults(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const add = (name: string, color: string) => map.set(name, (map.get(name) ?? new Set()).add(color.toUpperCase()));
  for (const p of CATEGORY_PARENTS) {
    for (const n of [p.name, p.he]) {
      add(n, p.color);
      add(n, LEGACY_PARENT_COLORS[p.name]);
      if (PASTEL_PARENT_COLORS[p.name]) add(n, PASTEL_PARENT_COLORS[p.name]);
    }
  }
  for (const c of SEED_CATEGORIES) add(c.name, c.color);
  for (const l of NEW_LEAVES) add(l.name, l.color);
  add("Fees & Taxes", "#C29B6F"); // 018
  return map;
}

/**
 * Gives built-in groups their own hue and built-in subcategories a shade of their group's
 * hue. Only rows still on a seeded color change, so user-picked colors (and user-made
 * categories) are never touched. Idempotent: recolored rows no longer match a default.
 */
export function applyFamilyColors(db: Database.Database, workspaceId?: number): void {
  const defaults = seededDefaults();
  const isDefault = (name: string, color: string) => defaults.get(name)?.has(color.toUpperCase()) ?? false;
  const workspaces = workspaceId != null ? [workspaceId] : (db.prepare("SELECT id FROM workspaces").all() as { id: number }[]).map((w) => w.id);
  const findParent = db.prepare("SELECT id, name, color FROM categories WHERE workspace_id = ? AND parent_id IS NULL AND name IN (?, ?)");
  const groups = db.prepare("SELECT id, name, color FROM categories WHERE workspace_id = ? AND parent_id IS NULL AND id IN (SELECT parent_id FROM categories WHERE parent_id IS NOT NULL)");
  // Child shades 050 derived from the pastel group colors count as app-seeded too.
  const pastelShades = new Map<string, Set<string>>();
  for (const p of CATEGORY_PARENTS) {
    const hex = PASTEL_PARENT_COLORS[p.name];
    if (!hex) continue;
    const set = new Set(Array.from({ length: 18 }, (_, i) => childColor(hex, i)));
    pastelShades.set(p.name, set).set(p.he, set);
  }
  const children = db.prepare("SELECT id, name, color FROM categories WHERE parent_id = ? ORDER BY id");
  const setColor = db.prepare("UPDATE categories SET color = ? WHERE id = ?");

  for (const ws of workspaces) {
    for (const p of CATEGORY_PARENTS) {
      const row = findParent.get(ws, p.name, p.he) as { id: number; name: string; color: string } | undefined;
      if (row && isDefault(row.name, row.color)) setColor.run(p.color, row.id);
    }
    for (const g of groups.all(ws) as { id: number; name: string; color: string }[]) {
      // Re-read: the group's own color may have just been updated above.
      const groupColor = (db.prepare("SELECT color FROM categories WHERE id = ?").get(g.id) as { color: string }).color;
      const shades = pastelShades.get(g.name);
      (children.all(g.id) as { id: number; name: string; color: string }[]).forEach((c, i) => {
        if (isDefault(c.name, c.color) || shades?.has(c.color.toUpperCase())) setColor.run(childColor(groupColor, i), c.id);
      });
    }
  }
}
