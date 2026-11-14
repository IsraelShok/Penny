import type { Category } from "./types";

export type PickerView = "groups" | "color" | "az";
export interface PickerSection { key: string; title?: string; color?: string; parentId?: number; items: Category[] }

const collator = new Intl.Collator("he");

/** Hue (0-359) of a #rrggbb color, or -1 for near-grays so they sort last. */
export function hueOf(hex: string): number {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(n)) return -1;
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.13) return -1; // slate grays like #A2AAC2
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(h * 60 + 360) % 360;
}

/**
 * Sections for the transaction category picker. Only leaves are choosable (parents are
 * roll-ups). Search matches a leaf's own label or its parent's label.
 */
export function buildPickerSections(cats: Category[], view: PickerView, query: string, label: (c: Category) => string): PickerSection[] {
  const byId = new Map(cats.map((c) => [c.id, c]));
  const isParent = new Set(cats.map((c) => c.parentId).filter((id): id is number => id != null));
  const q = query.trim().toLocaleLowerCase();
  const parentOf = (c: Category) => (c.parentId != null ? byId.get(c.parentId) : undefined);
  const leaves = cats.filter((c) => !isParent.has(c.id)).filter((c) => {
    if (!q) return true;
    const p = parentOf(c);
    return label(c).toLocaleLowerCase().includes(q) || (p != null && label(p).toLocaleLowerCase().includes(q));
  });
  const az = (a: Category, b: Category) => collator.compare(label(a), label(b));

  if (view === "az") return leaves.length ? [{ key: "az", items: [...leaves].sort(az) }] : [];

  if (view === "color") {
    const sorted = [...leaves].sort((a, b) => hueOf(b.color) - hueOf(a.color) || az(a, b));
    const sections: PickerSection[] = [];
    for (const c of sorted) {
      const h = hueOf(c.color);
      const key = h < 0 ? "gray" : `h${Math.floor(h / 30)}`;
      const last = sections[sections.length - 1];
      if (last?.key === key) last.items.push(c);
      else sections.push({ key, color: c.color, items: [c] });
    }
    return sections;
  }

  const groups = new Map<number | null, Category[]>();
  for (const c of leaves) {
    const pid = parentOf(c) ? c.parentId : null;
    groups.set(pid, [...(groups.get(pid) ?? []), c]);
  }
  const sections: PickerSection[] = [...groups.entries()]
    .filter(([pid]) => pid != null)
    .map(([pid, items]) => ({ key: `p${pid}`, parentId: pid!, title: label(byId.get(pid!)!), color: byId.get(pid!)!.color, items: items.sort(az) }))
    .sort((a, b) => collator.compare(a.title!, b.title!));
  const loose = groups.get(null);
  if (loose) sections.push({ key: "other", items: loose.sort(az) });
  return sections;
}
