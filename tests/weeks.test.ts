import { describe, expect, it } from "vitest";
import { groupByWeek, localToday, weekRelation, weekStart } from "@/lib/weeks";

describe("weekStart (Sunday)", () => {
  it("keeps Sunday and maps Saturday back to its Sunday", () => {
    expect(weekStart("2026-11-08")).toBe("2026-11-08"); // Sunday
    expect(weekStart("2026-11-14")).toBe("2026-11-08"); // Saturday
    expect(weekStart("2026-11-15")).toBe("2026-11-15"); // next Sunday
  });
  it("crosses month and year boundaries", () => {
    expect(weekStart("2026-12-02")).toBe("2026-11-29");
    expect(weekStart("2027-01-01")).toBe("2026-12-27");
  });
  it("is not shifted by DST changes (Israel: late March, late October)", () => {
    expect(weekStart("2026-03-28")).toBe("2026-03-22");
    expect(weekStart("2026-03-29")).toBe("2026-03-29");
    expect(weekStart("2026-10-25")).toBe("2026-10-25");
    expect(weekStart("2026-10-31")).toBe("2026-10-25");
  });
});

describe("groupByWeek", () => {
  it("groups consecutive dates by week, in list order, with the week's end", () => {
    const groups = groupByWeek([
      { date: "2026-12-01" },
      { date: "2026-11-29" },
      { date: "2026-11-28" },
      { date: "2026-11-22" },
    ]);
    expect(groups.map((g) => [g.start, g.end, g.items.length])).toEqual([
      ["2026-11-29", "2026-12-05", 2],
      ["2026-11-22", "2026-11-28", 2],
    ]);
  });
  it("returns no groups for no items", () => expect(groupByWeek([])).toEqual([]));
});

describe("weekRelation", () => {
  it("names this week and last week only", () => {
    expect(weekRelation("2026-11-08", "2026-11-14")).toBe("this");
    expect(weekRelation("2026-11-01", "2026-11-14")).toBe("last");
    expect(weekRelation("2026-10-25", "2026-11-14")).toBeNull();
    expect(weekRelation("2026-12-27", "2027-01-05")).toBe("last");
  });
  it("localToday formats the device date", () =>
    expect(localToday(new Date(2026, 0, 5))).toBe("2026-01-05"));
});
