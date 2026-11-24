import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { roundCents } from "@/lib/money";
import { parseCsv, toCsv } from "@/lib/csv";
import { computeDedupHash } from "@/server/lib/dedup";
import { israelDay } from "@/server/lib/date-utils";

// Property tests for the pure core: each one states what the function promises for every input,
// not for a hand-picked example.

describe("roundCents", () => {
  // 12 significant digits of cents: beyond ~₪1e9 the function no longer has two exact decimals.
  const amount = fc.double({ min: -1e7, max: 1e7, noNaN: true });

  it("is idempotent", () => {
    fc.assert(fc.property(amount, (n) => roundCents(roundCents(n)) === roundCents(n)));
  });

  it("returns at most two decimals", () => {
    fc.assert(fc.property(amount, (n) => Number(roundCents(n).toFixed(2)) === roundCents(n)));
  });

  it("stays within half an agora of the input", () => {
    fc.assert(fc.property(amount, (n) => Math.abs(roundCents(n) - n) <= 0.005 + 1e-9));
  });

  it("is symmetric around zero", () => {
    fc.assert(fc.property(amount, (n) => roundCents(-n) === -roundCents(n) || roundCents(n) === 0));
  });

  it("maps non-finite input to 0", () => {
    for (const n of [NaN, Infinity, -Infinity]) expect(roundCents(n)).toBe(0);
  });
});

describe("computeDedupHash", () => {
  const fields = fc.record({
    accountNumber: fc.string(),
    date: fc.string(),
    originalAmount: fc.double({ noNaN: true }),
    originalCurrency: fc.string(),
    description: fc.string(),
    identifier: fc.option(fc.oneof(fc.string(), fc.integer()), { nil: undefined }),
    installmentNumber: fc.option(fc.nat(), { nil: undefined }),
    installmentTotal: fc.option(fc.nat(), { nil: undefined }),
  });

  it("is deterministic and a sha256 hex string", () => {
    fc.assert(
      fc.property(fields, (f) => {
        const hash = computeDedupHash(f);
        return /^[0-9a-f]{64}$/.test(hash) && hash === computeDedupHash({ ...f });
      }),
    );
  });

  it("changes when any single text field changes", () => {
    const key = fc.constantFrom(
      "accountNumber",
      "date",
      "originalCurrency",
      "description",
    ) as fc.Arbitrary<"accountNumber" | "date" | "originalCurrency" | "description">;
    fc.assert(
      fc.property(fields, key, fc.string(), (f, k, value) => {
        fc.pre(value !== f[k]);
        return computeDedupHash({ ...f, [k]: value }) !== computeDedupHash(f);
      }),
    );
  });

  it("changes when the amount, identifier or an installment field changes", () => {
    fc.assert(
      fc.property(fields, fc.double({ noNaN: true }), fc.nat(), (f, amount, n) => {
        // The hash sees String(value), so -0 and 0 are the same amount.
        fc.pre(String(amount) !== String(f.originalAmount));
        const base = computeDedupHash(f);
        return (
          computeDedupHash({ ...f, originalAmount: amount }) !== base &&
          computeDedupHash({ ...f, identifier: `${f.identifier ?? ""}x` }) !== base &&
          computeDedupHash({ ...f, installmentNumber: (f.installmentNumber ?? n) + 1 }) !== base &&
          computeDedupHash({ ...f, installmentTotal: (f.installmentTotal ?? n) + 1 }) !== base
        );
      }),
    );
  });

  // The hash does not normalise text: the same row with different spacing is a different row.
  it("is sensitive to whitespace in the description", () => {
    fc.assert(
      fc.property(
        fields,
        (f) => computeDedupHash({ ...f, description: `${f.description} ` }) !== computeDedupHash(f),
      ),
    );
  });

  // FINDING: fields are joined with "|" and not escaped, so a "|" inside one field can be read as
  // the boundary to the next and two different rows hash the same. Bank account numbers and ISO
  // dates never contain "|", but a description can. Remove `.fails` once the join is unambiguous.
  it.fails("gives different rows different hashes when a field contains the separator", () => {
    const row = { accountNumber: "1", date: "2026-11-01", originalAmount: 5 };
    expect(computeDedupHash({ ...row, originalCurrency: "ILS|x", description: "y" })).not.toBe(
      computeDedupHash({ ...row, originalCurrency: "ILS", description: "x|y" }),
    );
  });
});

describe("israelDay", () => {
  const instant = fc.date({
    min: new Date("1970-01-01T00:00:00Z"),
    max: new Date("2100-01-01T00:00:00Z"),
    noInvalidDate: true,
  });
  const DAY = /^\d{4}-\d{2}-\d{2}$/;

  it("returns YYYY-MM-DD for every instant", () => {
    fc.assert(fc.property(instant, (d) => DAY.test(israelDay(d.toISOString()))));
  });

  it("is idempotent on its own output", () => {
    fc.assert(
      fc.property(instant, (d) => {
        const day = israelDay(d.toISOString());
        return israelDay(day) === day;
      }),
    );
  });

  it("maps the same instant written with another offset to the same day", () => {
    fc.assert(
      fc.property(instant, fc.integer({ min: -12, max: 14 }), (d, hours) => {
        const sign = hours < 0 ? "-" : "+";
        const offset = `${sign}${String(Math.abs(hours)).padStart(2, "0")}:00`;
        const shifted = new Date(d.getTime() + hours * 3_600_000)
          .toISOString()
          .replace("Z", offset);
        return israelDay(shifted) === israelDay(d.toISOString());
      }),
    );
  });

  it("is the UTC day or the day after (Israel is UTC+2/+3)", () => {
    fc.assert(
      fc.property(instant, (d) => {
        const utcDay = d.toISOString().slice(0, 10);
        const next = new Date(d.getTime() + 86_400_000).toISOString().slice(0, 10);
        return [utcDay, next].includes(israelDay(d.toISOString()));
      }),
    );
  });
});

describe("toCsv / parseCsv", () => {
  // What the pair promises: the parser trims cells, drops empty rows and sniffs the delimiter, and
  // the writer guards formula-looking text with a leading apostrophe. Inside those limits a table
  // survives the round trip, including quotes, commas and line breaks inside cells.
  const cell = fc
    .string()
    .filter((s) => s === s.trim() && !/[;\t|]/.test(s))
    .filter((s) => !/^[=+\-@]/.test(s) || /^[+-]?\d[\d.,]*$/.test(s));
  const row = fc.array(cell, { minLength: 1, maxLength: 6 }).filter((r) => r.some((c) => c !== ""));
  const table = fc.array(row, { minLength: 1, maxLength: 8 });

  it("round-trips a table", () => {
    fc.assert(
      fc.property(table, (rows) => {
        expect(parseCsv(toCsv(rows))).toEqual(rows);
      }),
    );
  });

  it("never lets text start a formula", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const out = toCsv([[s]]).replace(/^"/, "");
        return !/^[=@]/.test(out);
      }),
    );
  });
});
