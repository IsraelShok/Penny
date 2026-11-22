import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db/index", () => ({ getDb: () => ({}) }));

const { parseChart } = await import("@/server/markets/quotes");

const day = (iso: string) => Date.parse(`${iso}T15:00:00Z`) / 1000;
const chart = (currency: string, price: number, closes: number[], dates: string[]) => ({
  chart: {
    result: [
      {
        meta: {
          regularMarketPrice: price,
          currency,
          shortName: "X",
          regularMarketTime: day(dates[dates.length - 1]),
        },
        timestamp: dates.map(day),
        indicators: { quote: [{ close: closes }] },
      },
    ],
  },
});

describe("parseChart", () => {
  const dates = ["2025-11-05", "2025-12-31", "2026-01-02", "2026-11-04", "2026-11-05"];

  it("computes day, YTD and 12-month changes", () => {
    const q = parseChart(
      "^GSPC",
      chart("USD", 120, [100, 80, 82, 110, 120], dates),
      new Date(2026, 10, 5),
    )!;
    expect(q.currency).toBe("USD");
    expect(q.changeDay).toBeCloseTo(120 / 110 - 1);
    expect(q.changeYtd).toBeCloseTo(120 / 80 - 1);
    expect(q.change12m).toBeCloseTo(0.2);
    expect(q.series.at(-1)).toBe(120);
  });

  it("converts Tel Aviv agorot to shekels", () => {
    const q = parseChart(
      "TEVA.TA",
      chart("ILA", 5000, [4000, 4000, 4000, 4900, 5000], dates),
      new Date(2026, 10, 5),
    )!;
    expect(q.currency).toBe("ILS");
    expect(q.price).toBe(50);
  });

  it("returns null for an unknown symbol", () => {
    expect(
      parseChart("NOPE", { chart: { result: null, error: { code: "Not Found" } } }),
    ).toBeNull();
  });
});
