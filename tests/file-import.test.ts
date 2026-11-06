import { describe, expect, it } from "vitest";
import { buildImportRows, findHeaderRow, guessColumns, markDuplicates, parseImportDate } from "@/lib/file-import";

describe("findHeaderRow / guessColumns", () => {
  it("skips title rows and maps a card export", () => {
    const table = [["ישראכרט - פירוט עסקאות"], ["כרטיס 1234"], ["תאריך רכישה", "שם בית עסק", "סכום עסקה", "סכום חיוב", "פירוט נוסף"], ["01/02/2024", "קפה", "10", "10", ""]];
    expect(findHeaderRow(table)).toBe(2);
    expect(guessColumns(table[2])).toEqual({ date: 0, description: 1, amount: 3, debit: null, credit: null });
  });

  it("maps a bank export with debit/credit and ignores balance", () => {
    expect(guessColumns(["תאריך", "תאריך ערך", "תיאור", "אסמכתא", "חובה", "זכות", "יתרה בש\"ח"])).toEqual({ date: 0, description: 2, amount: null, debit: 4, credit: 5 });
    expect(guessColumns(["Date", "Description", "Amount", "Balance"])).toMatchObject({ date: 0, description: 1, amount: 2 });
  });

  it("returns -1 when nothing looks like a header", () => {
    expect(findHeaderRow([["a", "b"], ["1", "2"]])).toBe(-1);
  });
});

describe("parseImportDate", () => {
  it("reads Israeli formats and Excel serials", () => {
    expect(parseImportDate("05/03/2024")).toBe("2024-03-05");
    expect(parseImportDate("5.3.24")).toBe("2024-03-05");
    expect(parseImportDate("2024-03-05")).toBe("2024-03-05");
    expect(parseImportDate("45292")).toBe("2024-01-01");
    expect(parseImportDate("31/02/2024")).toBeNull();
    expect(parseImportDate("סה\"כ")).toBeNull();
  });
});

describe("buildImportRows", () => {
  const map = { date: 0, description: 1, amount: 2, debit: null, credit: null };
  it("flips card amounts and skips totals and blanks", () => {
    const { rows, skipped } = buildImportRows([["01/02/2024", "קפה", "₪12.50"], ["", "סה\"כ", "100"], ["02/02/2024", "זיכוי", "-5"]], map, true);
    expect(rows).toEqual([{ date: "2024-02-01", description: "קפה", amount: -12.5 }, { date: "2024-02-02", description: "זיכוי", amount: 5 }]);
    expect(skipped).toBe(1);
  });
  it("combines debit/credit columns", () => {
    const m = { date: 0, description: 1, amount: null, debit: 2, credit: 3 };
    expect(buildImportRows([["01/02/2024", "משכורת", "", "1,000.00"], ["01/02/2024", "חשמל", "300", ""]], m, true).rows.map((r) => r.amount)).toEqual([1000, -300]);
  });
});

describe("markDuplicates", () => {
  it("skips only as many identical rows as are already stored", () => {
    const r = { date: "2024-02-01", description: "קפה", amount: -12 };
    const out = markDuplicates([r, r, { ...r, amount: -13 }], new Map([["2024-02-01|-12|קפה", 1]]));
    expect(out.map((x) => [x.seq, x.duplicate])).toEqual([[1, true], [2, false], [1, false]]);
  });
});
