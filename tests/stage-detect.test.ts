import { describe, it, expect } from "vitest";
import { detectStageChanges } from "@/lib/stage-detect";
import { HARD_EVENTS } from "@/lib/household";
import type { SuggestionTxn } from "@/lib/suggestions";

const today = "2026-11-14";
const t = (date: string, description: string, amount: number): SuggestionTxn => ({
  date,
  description,
  amount,
  kind: amount < 0 ? "expense" : "income",
});
const mortgage = [t("2026-10-02", "משכנתא בנק", -4000), t("2026-09-02", "משכנתא בנק", -4000)];

describe("detectStageChanges", () => {
  it("homePurchase: two months of mortgage", () => {
    expect(detectStageChanges(mortgage, [], today)).toEqual([
      { key: "stageask:homePurchase", event: "homePurchase" },
    ]);
  });
  it("single-month mortgage gives nothing", () => {
    expect(
      detectStageChanges(
        [t("2026-10-02", "mortgage", -4000), t("2026-10-20", "mortgage", -10)],
        [],
        today,
      ),
    ).toEqual([]);
  });
  it("ignores old months and known events", () => {
    expect(
      detectStageChanges([t("2026-01-02", "משכנתא", -1), t("2026-02-02", "משכנתא", -1)], [], today),
    ).toEqual([]);
    expect(detectStageChanges(mortgage, ["homePurchase"], today)).toEqual([]);
  });
  it("birth: maternity income, or two baby expenses; known birth/newChild suppress", () => {
    const m = [t("2026-10-05", "דמי לידה", 8000)];
    expect(detectStageChanges(m, [], today)).toEqual([{ key: "stageask:birth", event: "birth" }]);
    expect(detectStageChanges(m, ["newChild"], today)).toEqual([]);
    expect(detectStageChanges(m, ["birth"], today)).toEqual([]);
    const b = [t("2026-10-05", "שילב", -90), t("2026-10-09", "baby store", -50)];
    expect(detectStageChanges(b, [], today)).toHaveLength(1);
    expect(detectStageChanges(b.slice(0, 1), [], today)).toEqual([]);
    expect(detectStageChanges([b[0], t("2026-10-09", "Babylon Pizza", -50)], [], today)).toEqual(
      [],
    );
  });
  it("retirement: old-age allowance income", () => {
    const r = [t("2026-10-01", "קצבת זקנה", 2000)];
    expect(detectStageChanges(r, [], today)).toEqual([
      { key: "stageask:retirement", event: "retirement" },
    ]);
    expect(detectStageChanges(r, ["retirement"], today)).toEqual([]);
    expect(detectStageChanges([t("2026-10-01", "קצבת זקנה", -2000)], [], today)).toEqual([]);
  });
  it("startedBusiness: tax advances in two months", () => {
    const b = [
      t("2026-10-15", "מקדמות מס הכנסה", -1500),
      t("2026-09-15", "מקדמות מס הכנסה", -1500),
    ];
    expect(detectStageChanges(b, [], today)).toEqual([
      { key: "stageask:startedBusiness", event: "startedBusiness" },
    ]);
    expect(detectStageChanges(b, ["startedBusiness"], today)).toEqual([]);
    expect(detectStageChanges(b.slice(0, 1), [], today)).toEqual([]);
  });
  it("never returns a hard event", () => {
    const all = [
      ...mortgage,
      t("2026-10-05", "דמי לידה", 8000),
      t("2026-10-01", "קצבת זקנה", 2000),
    ];
    for (const h of detectStageChanges(all, [], today)) expect(HARD_EVENTS).not.toContain(h.event);
  });
});
