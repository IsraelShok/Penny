import { describe, expect, it } from "vitest";
import {
  petLines,
  petMood,
  petNeedsCare,
  petTodo,
  petKey,
  petSnooze,
  petSnoozeUntil,
  parsePet,
  PET_ACTION,
  type PetInputs,
} from "@/lib/pet";
import { DEFAULT_PLAN, parsePlan } from "@/lib/plan";

const base: PetInputs = {
  spent: 4000,
  budget: 10000,
  elapsed: 0.5,
  emergencyMonths: 6,
  targetMonths: 6,
  savingsRate: 0.2,
  overdraft: false,
  uncategorized: 0,
};
const mood = (i: Partial<PetInputs>) => petMood(petLines({ ...base, ...i }));

describe("pet", () => {
  it("is happy when everything is fine, and fine with no data", () => {
    expect(mood({})).toBe("happy");
    expect(mood({ budget: null, savingsRate: null })).toBe("happy");
  });
  it("gets hungry when spending runs ahead of the month", () => {
    expect(mood({ spent: 7000 })).toBe("hungry");
    expect(petLines({ ...base, spent: 7000 })[1]).toEqual({
      stat: "food",
      ok: false,
      reason: "overPace",
      vars: { pct: 40 },
    });
  });
  it("is ok with one small thing to do", () => expect(mood({ uncategorized: 3 })).toBe("ok"));
  it("looks in with care (never sleeps) with an overdraft or several issues", () => {
    expect(mood({ overdraft: true })).toBe("caring");
    expect(mood({ uncategorized: 2, emergencyMonths: 0, savingsRate: 0 })).toBe("caring");
  });
  it("names the overdraft to pay off first, with the amount", () => {
    const lines = petLines({ ...base, overdraftAmount: 1234.4, uncategorized: 2 });
    expect(petTodo(lines, {}, "2026-11-14")[0]).toEqual({
      stat: "health",
      ok: false,
      reason: "overdraftAmount",
      vars: { amount: 1234 },
    });
  });
  it("maps every mood to a face action, none of them sleep", () => {
    expect(PET_ACTION).toEqual({ happy: "success", ok: "idle", hungry: "wary", caring: "inspect" });
  });
  it("hides snoozed and dismissed items from the list and the badge until their date", () => {
    const lines = petLines({ ...base, uncategorized: 2, spent: 7000 });
    const food = petKey(lines[1]);
    const snooze = { [food]: "2026-11-15" };
    expect(petTodo(lines, snooze, "2026-11-14").map((l) => l.stat)).toEqual(["tidy"]);
    expect(petNeedsCare(lines, snooze, "2026-11-14")).toBe(1);
    expect(petNeedsCare(lines, snooze, "2026-11-15")).toBe(2);
  });
  it("snoozes for a day, a week, or (dismiss) until next month, dropping expired entries", () => {
    const now = new Date(2026, 11, 30);
    expect(petSnoozeUntil("day", now)).toBe("2026-12-31");
    expect(petSnoozeUntil("week", now)).toBe("2027-01-06");
    expect(petSnoozeUntil("dismiss", now)).toBe("2027-01-01");
    expect(
      petSnooze(
        { "tidy:messy": "2026-12-01", "food:overPace": "2027-01-01" },
        "joy:saving",
        "2027-01-06",
        "2026-12-30",
      ),
    ).toEqual({ "food:overPace": "2027-01-01", "joy:saving": "2027-01-06" });
  });
  it("counts the stats needing care for the badge", () => {
    expect(petNeedsCare(petLines(base))).toBe(0);
    expect(petNeedsCare(petLines({ ...base, uncategorized: 2, spent: 7000 }))).toBe(2);
  });
  it("is on by default and respects an explicit off", () => {
    expect(DEFAULT_PLAN.pet.enabled).toBe(true);
    expect(parsePlan({}).pet.enabled).toBe(true);
    expect(parsePlan({ pet: { name: "Bo" } }).pet).toMatchObject({ enabled: true, name: "Bo" });
    expect(parsePlan({ pet: { enabled: false } }).pet.enabled).toBe(false);
  });
  it("keeps only valid looks", () => {
    expect(parsePet({ color: "#ABCDEF", size: "l", skin: "301" })).toMatchObject({
      color: "#abcdef",
      size: "l",
      skin: "301",
    });
    expect(parsePet({ color: "red;x", size: "toString", skin: "999" })).toMatchObject({
      color: "",
      size: "m",
      skin: "",
    });
    expect(
      parsePet({
        snooze: { "tidy:messy": "2026-12-01", "x y": "2026-12-01", "food:overPace": "soon" },
      }).snooze,
    ).toEqual({ "tidy:messy": "2026-12-01" });
  });
});

import { skinFor } from "@/lib/pet";
describe("skinFor", () => {
  it("picks the variant of a look closest to the chosen colour", () => {
    expect(["303", "312"]).toContain(skinFor("301", "#30d158")); // a green gummy
    expect(skinFor("301", "#0a84ff")).toBe("301"); // blue gummy
    expect(skinFor("401", "#ff375f")).not.toBe("401");
    expect(skinFor("", "#30d158")).toBe("");
    expect(skinFor("301", "")).toBe("301");
  });
});
