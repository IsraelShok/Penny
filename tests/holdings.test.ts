import { describe, it, expect } from "vitest";
import { lastChange } from "@/lib/holdings";

describe("lastChange", () => {
  it("finds when the value last changed and by how much", () => {
    const s = [{ date: "2026-11-01", valueIls: 1000 }, { date: "2026-11-05", valueIls: 1100 }, { date: "2026-11-06", valueIls: 1100 }];
    expect(lastChange(s, 1100)).toEqual({ since: "2026-11-05", prevIls: 1000, changeIls: 100, changePct: 0.1 });
  });
  it("compares to the last snapshot when today's value is new", () => {
    expect(lastChange([{ date: "2026-11-01", valueIls: 200 }], 150)).toMatchObject({ since: null, changeIls: -50, changePct: -0.25 });
  });
  it("has no change without history or value", () => {
    expect(lastChange([], 5)).toEqual({ since: null, prevIls: null, changeIls: null, changePct: null });
    expect(lastChange([{ date: "2026-11-01", valueIls: 5 }], 5)?.changeIls).toBeNull();
    expect(lastChange([], null)).toBeNull();
  });
});
