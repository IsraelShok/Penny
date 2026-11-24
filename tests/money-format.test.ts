import { describe, expect, it } from "vitest";
import { compactShekels, fmt, roundCents, roundSums, shekels, signedShekels } from "@/lib/money";

// Every ₪ string is wrapped in a left-to-right isolate so the sign stays in front inside Hebrew text.
const LRI = "⁦";
const PDI = "⁩";
const iso = (s: string) => `${LRI}${s}${PDI}`;

describe("fmt", () => {
  it("rounds to whole shekels by default, with thousands separators", () => {
    expect(fmt(1234567.891, "en")).toBe("1,234,568");
    expect(fmt(1234567.891, "he")).toBe("1,234,568");
    expect(fmt(0, "en")).toBe("0");
  });

  it("pads and rounds to the asked number of digits", () => {
    expect(fmt(1234.5, "en", 2)).toBe("1,234.50");
    expect(fmt(0, "he", 2)).toBe("0.00");
    expect(fmt(1.005, "en", 1)).toBe("1.0");
    expect(fmt(2.5, "en")).toBe("3"); // half away from zero, as people round money
  });

  it("formats Hebrew with the he-IL locale (a left-to-right mark before a minus), English with en-US", () => {
    expect(fmt(-1234.5, "he", 1)).toBe("‎-1,234.5");
    expect(fmt(-1234.5, "en", 1)).toBe("-1,234.5");
    // Anything that is not "he" is English.
    expect(fmt(-1234.5, "fr", 1)).toBe("-1,234.5");
  });
});

describe("shekels", () => {
  it("puts the shekel sign before the amount, inside one LTR run", () => {
    expect(shekels(1234, "he")).toBe(iso("₪1,234"));
    expect(shekels(1234.6, "en")).toBe(iso("₪1,235"));
  });

  it("shows a negative amount with a real minus sign in front of ₪", () => {
    expect(shekels(-1234, "he")).toBe(iso("−₪1,234"));
    expect(shekels(-1234, "en")).toBe(iso("−₪1,234"));
  });

  it("shows zero, and negative zero, without a sign", () => {
    expect(shekels(0, "he")).toBe(iso("₪0"));
    expect(shekels(-0, "he")).toBe(iso("₪0"));
  });
});

describe("signedShekels", () => {
  it("marks income with + and spending with −, and zero with neither", () => {
    expect(signedShekels(500, "en")).toBe(iso("+₪500"));
    expect(signedShekels(-500, "en")).toBe(iso("−₪500"));
    expect(signedShekels(0, "en")).toBe(iso("₪0"));
  });

  it("keeps the asked digits", () => {
    expect(signedShekels(12.5, "he", 2)).toBe(iso("+₪12.50"));
    expect(signedShekels(-0.25, "he", 2)).toBe(iso("−₪0.25"));
    expect(signedShekels(1999.99, "en")).toBe(iso("+₪2,000"));
  });
});

describe("compactShekels", () => {
  it("shortens thousands, millions and billions, one decimal at most", () => {
    expect(compactShekels(1500, "en")).toBe(iso("₪1.5K"));
    expect(compactShekels(1_249_999, "en")).toBe(iso("₪1.2M"));
    expect(compactShekels(1_200_000_000, "en")).toBe(iso("₪1.2B"));
    expect(compactShekels(999, "en")).toBe(iso("₪999"));
  });

  it("drops the bidi marks Hebrew formatting adds, so the isolate alone controls direction", () => {
    const he = compactShekels(950_500, "he");
    expect(he).toBe(iso("₪950.5K"));
    expect(he).not.toMatch(/[‎‏]/);
    expect(compactShekels(-2_700_000, "he")).toBe(iso("−₪2.7M"));
  });

  it("shows zero without a sign", () => {
    expect(compactShekels(0, "he")).toBe(iso("₪0"));
  });
});

describe("roundCents", () => {
  it("rounds half-up at the agora without float drift", () => {
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
    expect(roundCents(2.675)).toBe(2.68);
    expect(roundCents(10)).toBe(10);
    expect(roundCents(1.004)).toBe(1);
  });

  it("rounds negatives symmetrically (half away from zero)", () => {
    expect(roundCents(-1.005)).toBe(-1.01);
    expect(roundCents(-2.675)).toBe(-2.68);
    expect(roundCents(-0.001)).toBe(-0);
    expect(roundCents(-1.004)).toBe(-1);
  });

  it("returns 0 for values that are not a number of shekels", () => {
    expect(roundCents(Number.NaN)).toBe(0);
    expect(roundCents(Number.POSITIVE_INFINITY)).toBe(0);
    expect(roundCents(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("keeps large amounts exact to the agora", () => {
    expect(roundCents(1_234_567.891)).toBe(1_234_567.89);
    expect(roundCents(-9_999_999.995)).toBe(-10_000_000);
  });
});

describe("roundSums", () => {
  it("rounds only the named numeric fields of every row, in place", () => {
    const rows = [
      { total: 0.1 + 0.2, count: 3.333, label: "a" },
      { total: -1.005, count: 1.5, label: "b" },
    ];
    const out = roundSums(rows, "total");
    expect(out).toBe(rows);
    expect(rows).toEqual([
      { total: 0.3, count: 3.333, label: "a" },
      { total: -1.01, count: 1.5, label: "b" },
    ]);
  });

  it("accepts a single row and several keys", () => {
    const row = { income: 100.004, spent: 0.1 + 0.7, note: "x" };
    expect(roundSums(row, "income", "spent")).toBe(row);
    expect(row).toEqual({ income: 100, spent: 0.8, note: "x" });
  });

  it("leaves null sums (SUM over no rows) and non-numbers alone, and skips missing rows", () => {
    const rows = [{ total: null as number | null }, undefined as never, { total: 1.239 }];
    roundSums(rows, "total");
    expect(rows[0]).toEqual({ total: null });
    expect(rows[2]).toEqual({ total: 1.24 });
    const text = { total: "1.239" as unknown as number };
    roundSums(text, "total");
    expect(text.total).toBe("1.239");
  });
});
