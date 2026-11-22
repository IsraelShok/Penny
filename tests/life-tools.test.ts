import { describe, expect, it } from "vitest";
import { bankFeeAudit, foundAction, likelyRights, type RightsAnswers } from "@/lib/life-tools";
import { insuranceOverlaps } from "@/lib/insurance";

describe("bankFeeAudit", () => {
  it("picks the basic track for light use and counts the yearly saving", () => {
    expect(bankFeeAudit({ monthlyPaid: 30, direct: 8, teller: 0 })).toEqual({
      track: "basic",
      price: 10,
      yearlySaving: 240,
    });
  });
  it("moves to the extended track with more actions", () => {
    expect(bankFeeAudit({ monthlyPaid: 40, direct: 30, teller: 2 }).track).toBe("extended");
  });
  it("finds no track past the extended limits, and never a negative saving", () => {
    expect(bankFeeAudit({ monthlyPaid: 80, direct: 80, teller: 0 })).toEqual({
      track: null,
      price: 0,
      yearlySaving: 0,
    });
    expect(bankFeeAudit({ monthlyPaid: 5, direct: 1, teller: 0 }).yearlySaving).toBe(0);
  });
});

describe("foundAction", () => {
  it("merges an inactive pension into an active one, else moves it", () => {
    expect(foundAction("pension", true)).toBe("merge");
    expect(foundAction("pension", false)).toBe("move");
  });
  it("moves provident and study funds, claims bank accounts and policies", () => {
    expect(foundAction("hishtalmut", true)).toBe("move");
    expect(foundAction("bank", true)).toBe("claim");
    expect(foundAction("policy", false)).toBe("claim");
  });
});

describe("likelyRights", () => {
  const none: RightsAnswers = {
    worked: false,
    income: 0,
    kids: 0,
    age55: false,
    reserveDays: 0,
    renting: false,
    lostJob: false,
    singleParent: false,
    disability: false,
  };
  it("returns nothing for an empty questionnaire", () => {
    expect(likelyRights(none)).toEqual([]);
  });
  it("suggests the work grant to a low-wage working parent, with the child rights", () => {
    expect(likelyRights({ ...none, worked: true, income: 7_000, kids: 2 })).toEqual([
      "workGrant",
      "childAllowance",
      "childSavings",
      "arnona",
    ]);
  });
  it("skips the work grant on a high wage", () => {
    expect(likelyRights({ ...none, worked: true, income: 30_000, kids: 2 })).not.toContain(
      "workGrant",
    );
  });
  it("steps reserve-duty rights by days", () => {
    expect(likelyRights({ ...none, reserveDays: 29 })).toEqual([]);
    expect(likelyRights({ ...none, reserveDays: 35 })).toEqual(["reserveTax"]);
    expect(likelyRights({ ...none, reserveDays: 45 })).toEqual(["reserveTax", "reserveGrant"]);
  });
  it("suggests rent help to a renting single parent and unemployment after a job loss", () => {
    expect(likelyRights({ ...none, renting: true, singleParent: true, lostJob: true })).toEqual([
      "arnona",
      "rent",
      "unemployment",
    ]);
  });
});

describe("insuranceOverlaps", () => {
  const p = (name: string, kind: string, insured: string | null = null) =>
    ({ name, kind, insured }) as Parameters<typeof insuranceOverlaps>[0][number];
  it("flags two health policies for the same person only", () => {
    expect(
      insuranceOverlaps([p("A", "health", "Dana"), p("B", "health", "Dana")]).map((o) => o.kind),
    ).toEqual(["health"]);
    expect(insuranceOverlaps([p("A", "health", "Dana"), p("B", "health", "Avi")])).toEqual([]);
  });
  it("flags private health cover next to the health fund's supplementary plan", () => {
    const [o] = insuranceOverlaps([p("Private", "health"), p("Fund plus", "shaban")]);
    expect(o).toMatchObject({ kind: "shaban", who: "", names: ["Private", "Fund plus"] });
  });
  it("flags life policies stacked with mortgage life insurance", () => {
    expect(
      insuranceOverlaps([p("L1", "life", "Avi"), p("Mortgage", "mortgage_life", "Avi")]).map(
        (o) => o.kind,
      ),
    ).toEqual(["life"]);
  });
  it("flags other same-kind duplicates but not 'other'", () => {
    expect(
      insuranceOverlaps([p("C1", "car"), p("C2", "car"), p("X", "other"), p("Y", "other")]),
    ).toMatchObject([{ kind: "same", policyKind: "car" }]);
  });
  it("treats names with stray spaces as the same person", () => {
    expect(insuranceOverlaps([p("A", "health", "Dana "), p("B", "health", " Dana")])).toHaveLength(
      1,
    );
  });
});
