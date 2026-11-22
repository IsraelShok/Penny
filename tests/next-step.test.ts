import { describe, expect, it } from "vitest";
import { nextStep, type NextStepInput } from "../src/lib/next-step";
import type { Allocation } from "../src/lib/allocation";
import type { Suggestion } from "../src/lib/suggestions";

const alloc = (
  m: Partial<Allocation["monthly"]> = {},
  monthsToFull: number | null = null,
): Allocation => ({
  targets: { need: 0, want: 0, saving: 0 },
  surplus: 0,
  hold: { liquid: 0, moneyMarket: 0, emergency: 0 },
  monthly: { liquid: 0, moneyMarket: 0, market: 0, ...m },
  coveredMonths: 0,
  monthsToFull,
});
const base = (o: Partial<NextStepInput> = {}): NextStepInput => ({
  today: "done",
  month: "2026-11",
  stage: null,
  stageItemId: null,
  alloc: null,
  suggestions: [],
  dismissed: new Set(),
  stageHints: [],
  ...o,
});
const spike: Suggestion = {
  key: "spike:2026-11:Food",
  type: "spike",
  category: "Food",
  current: 1,
  avg: 1,
  pct: 50,
};
const fees: Suggestion = { key: "fees:2026", type: "fees", yearly: 100, count: 3 };

describe("nextStep", () => {
  it("returns null while loading or on error", () => {
    expect(nextStep(base({ today: "loading" }))).toBeNull();
    expect(nextStep(base({ today: "error" }))).toBeNull();
  });
  it("connect and sync", () => {
    expect(nextStep(base({ today: "connect" }))).toMatchObject({
      kind: "connect",
      href: "/settings/bank",
      dismissible: false,
    });
    expect(nextStep(base({ today: "sync" }))?.kind).toBe("sync");
  });
  it("cash beats money steps", () => {
    expect(nextStep(base({ today: "cash", alloc: alloc({ market: 5 }) }))).toMatchObject({
      kind: "cash",
      href: "/overview?tab=ahead",
      dismissible: false,
    });
  });
  it("buffer", () => {
    expect(nextStep(base({ alloc: alloc({ liquid: 500 }) }))).toMatchObject({
      kind: "buffer",
      key: "buffer:2026-11",
      amount: 500,
      href: "/overview?tab=ahead",
    });
  });
  it("gentle stage item beats money; no item falls to today", () => {
    const stage = { stageId: "loss", gentle: true };
    expect(
      nextStep(base({ stage, stageItemId: "loss-1", alloc: alloc({ market: 2000 }) })),
    ).toMatchObject({ kind: "stageItem", key: "stage:loss:loss-1:2026-11", href: "/life" });
    const r = nextStep(
      base({
        today: "review",
        stage,
        alloc: alloc({ market: 2000, moneyMarket: 9 }, 3),
        suggestions: [fees],
      }),
    );
    expect(r?.kind).toBe("review");
  });
  it("emergency", () => {
    expect(nextStep(base({ alloc: alloc({ moneyMarket: 1200 }, 9) }))).toMatchObject({
      kind: "emergency",
      key: "emergency:2026-11",
      amount: 1200,
      months: 9,
      href: "/investments",
    });
  });
  it("non-gentle stage item after emergency, before suggestions", () => {
    const stage = { stageId: "birth", gentle: false };
    expect(nextStep(base({ stage, stageItemId: "birth-3", suggestions: [fees] }))).toMatchObject({
      kind: "stageItem",
      key: "stage:birth:birth-3:2026-11",
    });
    expect(
      nextStep(base({ stage, stageItemId: "birth-3", alloc: alloc({ moneyMarket: 1 }, 2) }))?.kind,
    ).toBe("emergency");
  });
  it("picks the high-value suggestion", () => {
    expect(nextStep(base({ suggestions: [spike, fees] }))).toMatchObject({
      kind: "suggestion",
      key: "later:fees:2026:2026-11",
      href: "/more#suggestions",
    });
    expect(nextStep(base({ suggestions: [spike] }))).toBeNull();
  });
  it("invest", () => {
    expect(nextStep(base({ alloc: alloc({ market: 3000 }) }))).toMatchObject({
      kind: "invest",
      key: "invest:2026-11",
      amount: 3000,
      href: "/investments",
    });
  });
  it("today fallbacks", () => {
    expect(nextStep(base({ today: "review" }))).toMatchObject({
      kind: "review",
      href: "/transactions",
    });
    expect(nextStep(base({ today: "suggestions" }))).toMatchObject({
      kind: "suggestions",
      href: "/more#suggestions",
    });
    expect(nextStep(base({ today: "done" }))).toBeNull();
  });
  it("dismissed keys are skipped; non-dismissible ignore dismissed", () => {
    const stage = { stageId: "birth", gentle: false };
    const dismissed = new Set([
      "buffer:2026-11",
      "emergency:2026-11",
      "stage:birth:birth-3:2026-11",
      "later:fees:2026:2026-11",
      "invest:2026-11",
    ]);
    const a = alloc({ liquid: 1, moneyMarket: 1, market: 1 }, 2);
    expect(
      nextStep(
        base({
          today: "review",
          stage,
          stageItemId: "birth-3",
          alloc: a,
          suggestions: [fees],
          dismissed,
        }),
      )?.kind,
    ).toBe("review");
    const all = new Set(["connect", "sync", "cash", "buffer:2026-11"]);
    expect(nextStep(base({ today: "cash", dismissed: all }))?.kind).toBe("cash");
    expect(nextStep(base({ today: "connect", dismissed: all }))?.kind).toBe("connect");
  });
  it("a later: dismissal skips that suggestion for the month only", () => {
    const next = { key: "idle:2026", type: "idle", amount: 9 } as unknown as Suggestion;
    expect(
      nextStep(
        base({ suggestions: [fees, next], dismissed: new Set(["later:fees:2026:2026-11"]) }),
      ),
    ).toMatchObject({ key: "later:idle:2026:2026-11" });
    expect(
      nextStep(
        base({ suggestions: [fees, next], dismissed: new Set(["later:fees:2026:2026-10"]) }),
      ),
    ).toMatchObject({ key: "later:fees:2026:2026-11" });
  });
  it("null alloc yields no money step", () => {
    expect(nextStep(base({ alloc: null }))).toBeNull();
  });
  it("stage ask comes after cash, before buffer", () => {
    const stageHints = [{ key: "stageask:homePurchase", event: "homePurchase" as const }];
    expect(nextStep(base({ stageHints, alloc: alloc({ liquid: 500 }) }))).toMatchObject({
      kind: "stageAsk",
      key: "stageask:homePurchase",
      event: "homePurchase",
      dismissible: false,
    });
    expect(nextStep(base({ today: "cash", stageHints }))?.kind).toBe("cash");
  });
  it("stage ask is skipped when gentle or dismissed", () => {
    const stageHints = [{ key: "stageask:birth", event: "birth" as const }];
    expect(nextStep(base({ stageHints, stage: { stageId: "", gentle: true } }))).toBeNull();
    expect(nextStep(base({ stageHints, dismissed: new Set(["stageask:birth"]) }))).toBeNull();
  });
});
