import { describe, expect, it } from "vitest";
import {
  creditCheck,
  depositPlan,
  lossOffset,
  marginalRate,
  type CreditAnswers,
} from "@/lib/tax-benefits";

const base: CreditAnswers = {
  sex: "woman",
  children: [0, 0, 0, 0, 0, 0],
  singleParent: false,
  degree: "none",
  service: "none",
  aliyahYear: 0,
  monthlyGross: 15_000,
  donations: 0,
  lifeInsurance: 0,
  privatePension: 0,
  changedJobs: false,
  qualifyingTown: false,
};

describe("marginalRate", () => {
  it("picks the bracket the next shekel falls in", () => {
    expect(marginalRate(5_000)).toBe(0.1);
    expect(marginalRate(15_000)).toBe(0.2);
    expect(marginalRate(1_000_000)).toBe(0.5);
  });
});

describe("creditCheck", () => {
  it("nothing extra: entitled equals likely, no refund", () => {
    const r = creditCheck(base);
    expect(r.likely).toBe(2.75);
    expect(r.entitled).toBe(2.75);
    expect(r.refund).toBe(0);
    expect(r.checks).toEqual([]);
  });

  it("children by age: mother vs father", () => {
    const kids = [1, 1, 0, 0, 2, 0];
    expect(creditCheck({ ...base, children: kids }).likely).toBe(2.75 + 2.5 + 4.5 + 4);
    const dad = creditCheck({ ...base, sex: "man", children: kids });
    expect(dad.likely).toBe(2.25 + 2.5 + 4.5 + 2);
    expect(dad.checks).toContain("fatherKids");
  });

  it("degree + full service + donation add up, worth 242 × 12 per point", () => {
    const r = creditCheck({ ...base, degree: "ba", service: "full", donations: 1_000 });
    expect(r.extra).toBe(3);
    expect(r.refund).toBeCloseTo(3 * 2_904 + 350, 5);
    expect(r.checks).toEqual(["form101", "donations"]);
  });

  it("donation at or below the minimum gives nothing", () => {
    expect(creditCheck({ ...base, donations: 207 }).refund).toBe(0);
  });

  it("refund never exceeds the tax actually paid", () => {
    const r = creditCheck({
      ...base,
      monthlyGross: 6_000,
      degree: "ba",
      service: "full",
      aliyahYear: 2,
    });
    expect(r.refund).toBe(0); // 2.75 points already wipe out tax on ₪6,000
  });
});

describe("depositPlan", () => {
  it("salaried: pension credit up to 7% of the capped salary, study fund up to the ceiling", () => {
    const r = depositPlan({
      selfEmployed: false,
      monthlyIncome: 20_000,
      pensionMonthly: 600,
      studyMonthly: 1_000,
    });
    expect(r.pension.max).toBeCloseTo(0.07 * 9_700 * 12, 5);
    expect(r.pension.unused).toBeCloseTo(0.07 * 9_700 * 12 - 7_200, 5);
    expect(r.pension.benefitMax).toBeCloseTo(0.35 * 0.07 * 9_700 * 12, 5);
    expect(r.study.max).toBeCloseTo(15_712 * 1.2, 5);
    expect(r.study.benefit).toBeCloseTo(0.31 * 0.75 * 12_000, 5);
  });

  it("self-employed: 16.5% pension split into credit and deduction, 4.5% study fund", () => {
    const r = depositPlan({
      selfEmployed: true,
      monthlyIncome: 15_000,
      pensionMonthly: 0,
      studyMonthly: 0,
    });
    const q = 180_000;
    expect(r.pension.max).toBeCloseTo(0.165 * q, 5);
    expect(r.pension.benefitMax).toBeCloseTo(0.35 * 0.055 * q + 0.2 * 0.11 * q, 5);
    expect(r.study.max).toBeCloseTo(0.045 * q, 5);
    expect(r.missed).toBeCloseTo(r.pension.benefitMax + r.study.benefitMax, 5);
  });

  it("caps qualifying income", () => {
    expect(
      depositPlan({
        selfEmployed: true,
        monthlyIncome: 100_000,
        pensionMonthly: 0,
        studyMonthly: 0,
      }).pension.max,
    ).toBeCloseTo(38_412, 0);
  });
});

describe("lossOffset", () => {
  it("saves 25% of the smaller of gains and losses, carries the rest", () => {
    expect(lossOffset(40_000, 10_000)).toEqual({
      taxBefore: 10_000,
      taxAfter: 7_500,
      saved: 2_500,
      carryForward: 0,
    });
    expect(lossOffset(5_000, 8_000)).toEqual({
      taxBefore: 1_250,
      taxAfter: 0,
      saved: 1_250,
      carryForward: 3_000,
    });
  });
});
