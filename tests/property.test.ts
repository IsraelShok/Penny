import { describe, expect, it } from "vitest";
import { indexRevaluation } from "@/lib/property";

const series = [
  { month: "2020-01", value: 400 },
  { month: "2020-02", value: 410 },
  { month: "2026-07", value: 600 },
];

describe("indexRevaluation", () => {
  it("scales the purchase price by the index change", () => {
    expect(indexRevaluation(1_000_000, "2020-01", series)).toEqual({ value: 1_500_000, change: 0.5, indexMonth: "2026-07" });
  });
  it("uses the last published month at or before the purchase", () => {
    expect(indexRevaluation(1_000_000, "2023-05", series)?.value).toBe(Math.round(1_000_000 * (600 / 410)));
  });
  it("keeps the price for a purchase after the latest index", () => {
    expect(indexRevaluation(900_000, "2026-10", series)?.value).toBe(900_000);
  });
  it("has no estimate before the series or for bad input", () => {
    expect(indexRevaluation(1_000_000, "2019-12", series)).toBeNull();
    expect(indexRevaluation(0, "2020-01", series)).toBeNull();
    expect(indexRevaluation(1_000_000, "2020-1", series)).toBeNull();
    expect(indexRevaluation(1_000_000, "2020-01", [])).toBeNull();
  });
});
