import { describe, expect, it } from "vitest";
import { TIPS, TIP_CATEGORIES, relevantTips, tipKey, tipOfDay, tipSignals } from "@/lib/tips";

describe("tips", () => {
  it("has unique ids, known categories and both languages", () => {
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length);
    expect(TIPS.length).toBeGreaterThanOrEqual(60);
    for (const t of TIPS) {
      expect(TIP_CATEGORIES).toContain(t.category);
      expect(t.he.title && t.he.body && t.en.title && t.en.body).toBeTruthy();
    }
  });

  it("maps suggestions, kids and month to signals", () => {
    const s = tipSignals(["interest", "fxMarkup", "payday"], {
      hasKids: true,
      today: "2026-11-14",
    });
    expect([...s].sort()).toEqual(["fx", "kids", "overdraft", "salesSeason", "taxSeason"]);
    expect(tipSignals([], { hasKids: false, today: "2026-07-01" }).has("summer")).toBe(true);
  });

  it("puts triggered tips first and hides unmatched triggered ones", () => {
    const list = relevantTips(new Set(["overdraft"]), new Set(), "debt");
    expect(list[0].triggers).toContain("overdraft");
    expect(list.some((t) => t.triggers.includes("debt") && !t.triggers.includes("overdraft"))).toBe(
      false,
    );
    expect(list.some((t) => t.triggers.length === 0)).toBe(true);
    expect(relevantTips(new Set(), new Set(), "kids")).toEqual(
      relevantTips(new Set(), new Set(), "kids").filter((t) => t.triggers.length === 0),
    );
  });

  it("drops dismissed tips and rotates a stable daily tip", () => {
    const sig = new Set(["overdraft"] as const);
    const first = relevantTips(sig, new Set(), "debt")[0];
    expect(relevantTips(sig, new Set([tipKey(first.id)]), "debt")[0].id).not.toBe(first.id);
    const a = tipOfDay(sig, new Set(), "2026-11-14");
    expect(tipOfDay(sig, new Set(), "2026-11-14")).toBe(a);
    const even =
      Math.floor(Date.parse("2026-11-14T00:00:00Z") / 86_400_000) % 2 === 0
        ? "2026-11-14"
        : "2026-11-15";
    expect(tipOfDay(sig, new Set(), even)!.triggers).toContain("overdraft");
    expect(tipOfDay(sig, new Set(TIPS.map((t) => tipKey(t.id))), even)).toBeNull();
  });
});
