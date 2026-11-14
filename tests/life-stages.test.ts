import { describe, expect, it } from "vitest";
import { EMPTY_HOUSEHOLD, type Household } from "@/lib/household";
import { EMPTY_PROFILE } from "@/lib/plan";
import { LIFE_STAGES, currentStage, parseProgress, relevantStages } from "@/lib/life-stages";

const today = new Date("2026-11-06");
const h = (patch: Partial<Household>): Household => ({ ...EMPTY_HOUSEHOLD, ...patch });
const member = (role: Household["members"][number]["role"], birthYear: number) => ({ id: role + birthYear, name: "x", role, birthYear });

describe("relevantStages", () => {
  it("is empty for an empty profile", () => {
    expect(relevantStages(EMPTY_HOUSEHOLD, today)).toEqual([]);
  });
  it("maps ages to stages", () => {
    const ids = relevantStages(h({ members: [member("child", 2026), member("child", 2018), member("child", 2006), member("me", 1970)] }), today);
    expect(ids).toEqual(expect.arrayContaining(["birth", "kids", "young", "preRetirement"]));
    expect(relevantStages(h({ members: [member("me", 1955)] }), today)).toEqual(["retirement"]);
  });
  it("maps income shape and recent events, hard stages first", () => {
    const ids = relevantStages(h({ incomeShape: "freelancer", events: [
      { id: "1", type: "homePurchase", date: "2026-01-01" },
      { id: "2", type: "divorce", date: "2026-05-01" },
      { id: "3", type: "wedding", date: "2010-01-01" },
    ] }), today);
    expect(ids).toEqual(["divorce", "freelance", "home"]);
  });
  it("every stage has 4–8 items and https links", () => {
    expect(LIFE_STAGES).toHaveLength(17);
    for (const s of LIFE_STAGES) {
      expect(s.items.length).toBeGreaterThanOrEqual(4);
      expect(s.items.length).toBeLessThanOrEqual(8);
      for (const l of s.links) expect(l.url).toMatch(/^https:\/\//);
    }
  });
});

describe("parseProgress", () => {
  it("keeps only known stage and item ids", () => {
    expect(parseProgress({ birth: ["birth-1", "nope"], fake: ["x"], kids: "bad" })).toEqual({ birth: ["birth-1"] });
    expect(parseProgress(null)).toEqual({});
  });
});

describe("keyItem", () => {
  it("is an item of its own stage", () => {
    for (const s of LIFE_STAGES) expect(s.items.map((i) => i.id)).toContain(s.keyItem);
  });
});

describe("currentStage", () => {
  const plan = (birthYear: number | null, situation: (typeof EMPTY_PROFILE)["situation"] = null) => ({ birthYear, profile: { ...EMPTY_PROFILE, situation } });
  it("is null with nothing known", () => {
    expect(currentStage(EMPTY_HOUSEHOLD, plan(null), today)).toBeNull();
  });
  it("takes the most pressing stage and flags it gentle", () => {
    const hh = h({ incomeShape: "freelancer", events: [{ id: "1", type: "divorce", date: "2026-05-01" }] });
    expect(currentStage(hh, plan(null), today)).toEqual({ stageId: "divorce", gentle: true });
  });
  it("uses the plan birth year when no member has one", () => {
    expect(currentStage(EMPTY_HOUSEHOLD, plan(1960), today)).toEqual({ stageId: "preRetirement", gentle: false });
  });
  it("falls back to the profile situation", () => {
    const want = { student: "young", selfEmployed: "freelance", family: "growingFamily", retired: "retirement" } as const;
    for (const [sit, id] of Object.entries(want)) expect(currentStage(EMPTY_HOUSEHOLD, plan(null, sit as keyof typeof want), today)?.stageId).toBe(id);
  });
  it("gives an employee with nothing else no stage", () => {
    expect(currentStage(EMPTY_HOUSEHOLD, plan(null, "employee"), today)).toBeNull();
  });
  it("is gentle for a gentle stage even when the event is over a year old", () => {
    const hh = h({ events: [{ id: "1", type: "loss", date: "2025-06-01" }] });
    expect(currentStage(hh, plan(null), today)).toEqual({ stageId: "loss", gentle: true });
  });
});
