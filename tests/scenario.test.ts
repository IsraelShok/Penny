import { it, expect } from "vitest";
import { scenarioPoints } from "@/lib/scenario";
import { forecastBalance } from "@/lib/balance-forecast";
import { parseLayout, WIDGETS } from "@/lib/personal-layout";
it("applies dated spending and monthly transfers, clamps short months and preserves baseline", () => {
  const base = forecastBalance({
    today: "2027-01-31",
    bank: 1000,
    payday: 1,
    monthlyIncome: 0,
    bills: [],
    recurring: [],
    days: 60,
  }).points;
  const result = scenarioPoints(base, { expense: 100, date: "2027-02-10", monthlySaving: 200 });
  expect(result.find((p) => p.date === "2027-02-09")?.balance).toBe(1000);
  expect(result.find((p) => p.date === "2027-02-10")?.balance).toBe(900);
  expect(result.find((p) => p.date === "2027-02-28")?.balance).toBe(700);
  expect(result.find((p) => p.date === "2027-03-31")?.balance).toBe(500);
  expect(base.at(-1)?.balance).toBe(1000);
});
it("recovers layouts without duplicate or unknown widgets", () => {
  const tiles = parseLayout([{ id: "planner", wide: true }, { id: "planner" }, { id: "garbage" }]);
  expect(tiles).toHaveLength(WIDGETS.length);
  expect(tiles[0]).toMatchObject({ id: "planner", wide: true });
});
