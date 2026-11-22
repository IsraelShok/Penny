import { describe, expect, it } from "vitest";
import { headerFingerprint } from "@/lib/file-import";
import { sniffImageType } from "@/lib/text-import";

describe("headerFingerprint", () => {
  it("matches the same layout regardless of case, spacing and trailing blanks", () => {
    expect(headerFingerprint([" Date ", "Description", "Amount", "", ""])).toBe(
      headerFingerprint(["date", "description  ", "AMOUNT"]),
    );
  });
  it("tells different layouts apart and has no key for an empty header", () => {
    expect(headerFingerprint(["תאריך", "סכום"])).not.toBe(headerFingerprint(["סכום", "תאריך"]));
    expect(headerFingerprint(["", " "])).toBe("");
  });
});

describe("sniffImageType", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(12).fill(0)]);
  it("reads the type from magic bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47))).toBe("image/png");
    expect(sniffImageType(bytes(0x47, 0x49, 0x46))).toBe("image/gif");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });
  it("rejects a PDF or text", () => {
    expect(sniffImageType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("date,amount"))).toBeNull();
  });
});
