import { describe, expect, it } from "vitest";
import { parseTrip, perPersonNight, tripMonthly, tripNights, tripTotal } from "@/lib/trip";
import { kidProjection, parseKids, STATE_MONTHLY_PER_CHILD } from "@/lib/kids";

const trip = parseTrip({
  start: "2027-08-01",
  end: "2027-08-08",
  travelers: 4,
  lines: { flights: 8000, lodging: 6000, food: -5, bogus: 9 },
})!;

describe("vacation plan", () => {
  it("parses, totals and counts nights", () => {
    expect(trip.lines).toEqual({ flights: 8000, lodging: 6000 });
    expect(tripTotal(trip)).toBe(14000);
    expect(tripNights(trip)).toBe(7);
    expect(parseTrip({ start: "2027-08-08", end: "2027-08-01" })).toBeNull();
  });
  it("estimates a line per person per night", () => {
    expect(perPersonNight(100, 4, 7)).toBe(2800);
    expect(perPersonNight(100, 2, 0)).toBe(200);
  });
  it("monthly saving splits the gap over the months left", () => {
    // Nov 2026 → Aug 2027 = 9 months; gap 14000 - 5000
    expect(tripMonthly(trip, 5000, new Date(2026, 10, 14))).toBe(1000);
    expect(tripMonthly(trip, 20000, new Date(2026, 10, 14))).toBe(0);
    expect(tripMonthly(trip, 0, new Date(2027, 7, 2))).toBe(14000);
  });
});

describe("kid projection", () => {
  it("with no return equals deposits", () => {
    const p = kidProjection(
      { stateValue: 1000, doubling: true, extraMonthly: 100, returnPct: 0 },
      2000,
      15,
    );
    expect(p.state18).toBeCloseTo(1000 + STATE_MONTHLY_PER_CHILD * 2 * 36);
    expect(p.state21).toBeCloseTo(p.state18); // no deposits after 18
    expect(p.parent18).toBeCloseTo(2000 + 100 * 36);
    expect(p.parent21).toBeCloseTo(2000 + 100 * 72);
    expect(p.at21).toBeCloseTo(p.state21 + p.parent21);
  });
  it("compounds and stops at adulthood", () => {
    const p = kidProjection(
      { stateValue: 10000, doubling: false, extraMonthly: 0, returnPct: 5 },
      0,
      18,
    );
    expect(p.state18).toBe(10000);
    expect(p.state21).toBeCloseTo(10000 * 1.05 ** 3);
    expect(
      kidProjection({ stateValue: 0, doubling: false, extraMonthly: 0, returnPct: 5 }, 0, 25).at21,
    ).toBe(0);
  });
  it("parses safely", () => {
    expect(
      parseKids([{ memberId: "a", track: "x", returnPct: 99, assetIds: [1, "2"] }, { nope: 1 }]),
    ).toEqual([
      {
        memberId: "a",
        stateValue: 0,
        track: "medium",
        doubling: false,
        extraMonthly: 0,
        returnPct: 15,
        assetIds: [1],
      },
    ]);
  });
});
