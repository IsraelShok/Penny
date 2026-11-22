import { describe, expect, it } from "vitest";
import { parseAmount, parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("handles quotes, commas inside quotes and CRLF", () => {
    expect(parseCsv('﻿name,value\r\n"Teva, Ltd",1200\r\n"say ""hi""",5\r\n')).toEqual([
      ["name", "value"],
      ["Teva, Ltd", "1200"],
      ['say "hi"', "5"],
    ]);
  });

  it("detects semicolon and tab delimiters", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseAmount", () => {
  it("reads common money formats", () => {
    expect(parseAmount("₪1,234.50")).toBe(1234.5);
    expect(parseAmount("1.234,5")).toBe(1234.5);
    expect(parseAmount("(12)")).toBe(-12);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
});
