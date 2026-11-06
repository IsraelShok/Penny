import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN, EMPTY_PROFILE, parsePlan, profileEffects, wantsExplanations } from "@/lib/plan";
import { pagePurposeKey } from "@/lib/orientation";

describe("plan profile", () => {
  it("defaults to an empty, not-onboarded profile", () => {
    expect(parsePlan({}).profile).toEqual(EMPTY_PROFILE);
  });

  it("keeps valid answers and drops bad ones", () => {
    const p = parsePlan({ profile: { situation: "student", householdSize: 3, goal: "save", goalNote: "  trip ", confidence: "x", detail: "detailed", onboarded: true } }).profile;
    expect(p).toEqual({ situation: "student", householdSize: 3, goal: "save", goalNote: "trip", confidence: null, detail: "detailed", onboarded: true });
    expect(parsePlan({ profile: { householdSize: 99, situation: "king" } }).profile).toMatchObject({ householdSize: null, situation: null });
  });

  it("drives simple mode from confidence and detail", () => {
    expect(profileEffects({ ...EMPTY_PROFILE, confidence: "beginner" })).toEqual({ simpleMode: true });
    expect(profileEffects({ ...EMPTY_PROFILE, confidence: "advanced" })).toEqual({ simpleMode: false });
    // An explicit detail choice wins over confidence.
    expect(profileEffects({ ...EMPTY_PROFILE, confidence: "beginner", detail: "detailed" })).toEqual({ simpleMode: false });
    expect(profileEffects(EMPTY_PROFILE)).toEqual({});
  });

  it("explains more to beginners and simple-mode users without an answer", () => {
    expect(wantsExplanations({ ...DEFAULT_PLAN, profile: { ...EMPTY_PROFILE, confidence: "beginner" } })).toBe(true);
    expect(wantsExplanations({ ...DEFAULT_PLAN, simpleMode: true })).toBe(true);
    expect(wantsExplanations({ ...DEFAULT_PLAN, simpleMode: true, profile: { ...EMPTY_PROFILE, confidence: "advanced" } })).toBe(false);
    expect(wantsExplanations(DEFAULT_PLAN)).toBe(false);
  });
});

describe("pagePurposeKey", () => {
  it("maps a page and its sub-pages to one key", () => {
    expect(pagePurposeKey("/budget")).toBe("budget");
    expect(pagePurposeKey("/settings/appearance")).toBe("settings");
    expect(pagePurposeKey("/")).toBeNull();
    expect(pagePurposeKey("/welcome")).toBeNull();
  });
});
