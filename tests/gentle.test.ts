import { describe, expect, it } from "vitest";
import { gentleKey } from "@/lib/gentle";

describe("gentleKey", () => {
  const has = (k: string) => k === "fine_gentle";
  it("uses the variant only when gentle and it exists", () => {
    expect(gentleKey("fine", true, has)).toBe("fine_gentle");
    expect(gentleKey("fine", false, has)).toBe("fine");
    expect(gentleKey("short", true, has)).toBe("short");
  });
});
