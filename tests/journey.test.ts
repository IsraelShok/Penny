import { describe, expect, it } from "vitest";
import { detectMilestones, sortNewestFirst } from "@/lib/milestones";
import { homeTeasers } from "@/lib/home-layout";
import { EMPTY_HOUSEHOLD, shouldShowWelcome, type Household } from "@/lib/household";

const base = { history: [], liabilities: [], goals: [], months: [], cashReserve: 0, monthlyExpenses: 0 };

describe("detectMilestones", () => {
  it("finds net-worth crossings, not starting points", () => {
    const m = detectMilestones({
      ...base,
      history: [
        { date: "2025-03-01", netWorth: 60_000 },
        { date: "2025-01-01", netWorth: 5_000 },
        { date: "2025-02-01", netWorth: 12_000 },
      ],
    });
    expect(m).toEqual([
      { kind: "netWorth", amount: 10_000, date: "2025-02-01" },
      { kind: "netWorth", amount: 50_000, date: "2025-03-01" },
    ]);
  });

  it("skips a step the household started above", () => {
    expect(detectMilestones({ ...base, history: [{ date: "2025-01-01", netWorth: 20_000 }] })).toEqual([]);
  });

  it("finds paid debts, reached goals, first 20% month and emergency fund", () => {
    const m = detectMilestones({
      ...base,
      liabilities: [{ name: "Car loan", value: 0, updatedAt: "2025-05-03T10:00:00Z" }, { name: "Mortgage", value: 900_000 }],
      goals: [{ name: "Trip", targetAmount: 5000, savedAmount: 5000 }, { name: "Car", targetAmount: 5000, savedAmount: 10 }],
      months: [
        { month: "2025-04", income: 10_000, kept: 2500 },
        { month: "2025-02", income: 10_000, kept: 1000 },
        { month: "2025-03", income: 10_000, kept: 2000 },
      ],
      cashReserve: 40_000,
      monthlyExpenses: 10_000,
    });
    expect(m).toEqual([
      { kind: "debtPaid", name: "Car loan", date: "2025-05-03" },
      { kind: "goalReached", name: "Trip", date: null },
      { kind: "savingsRate", month: "2025-03", rate: 0.2, date: "2025-03-01" },
      { kind: "emergency", months: 3, date: null },
    ]);
  });

  it("sorts newest first with undated on top", () => {
    expect(sortNewestFirst([{ date: "2024-01-01" }, { date: null }, { date: "2025-01-01" }])).toEqual([
      { date: null },
      { date: "2025-01-01" },
      { date: "2024-01-01" },
    ]);
  });
});

describe("homeTeasers", () => {
  const h = (p: Partial<Household>): Household => ({ ...EMPTY_HOUSEHOLD, ...p });
  const kid = { id: "k", name: "Noa", role: "child" as const, birthYear: 2018 };
  const partner = { id: "p", name: "Dan", role: "partner" as const, birthYear: null };
  const all = { childSpend: true, settleUp: true };

  it("shows nothing for an empty profile", () => {
    expect(homeTeasers(EMPTY_HOUSEHOLD, all)).toEqual([]);
  });
  it("freelancers get the tax set-aside", () => {
    expect(homeTeasers(h({ incomeShape: "mixed" }), all)).toEqual(["taxSetAside"]);
  });
  it("hides a teaser without data and caps at two", () => {
    expect(homeTeasers(h({ members: [kid, partner] }), { childSpend: false, settleUp: true })).toEqual(["settleUp"]);
    expect(homeTeasers(h({ incomeShape: "freelancer", members: [kid, partner] }), all)).toEqual(["taxSetAside", "childSpend"]);
  });
  it("joint money needs no settle-up; pension gets no salary items", () => {
    expect(homeTeasers(h({ members: [partner], moneyStyle: "joint" }), all)).toEqual([]);
    expect(homeTeasers(h({ incomeShape: "pension" }), all)).toEqual([]);
  });
  it("students and no-income emphasize free-to-spend", () => {
    expect(homeTeasers(h({ incomeShape: "allowance" }), all)).toEqual(["freeToSpend"]);
  });
});

describe("shouldShowWelcome", () => {
  it("only for an empty, undismissed profile", () => {
    expect(shouldShowWelcome(EMPTY_HOUSEHOLD)).toBe(true);
    expect(shouldShowWelcome({ ...EMPTY_HOUSEHOLD, welcomeDismissed: true })).toBe(false);
    expect(shouldShowWelcome({ ...EMPTY_HOUSEHOLD, incomeShape: "salaried" })).toBe(false);
  });
});
