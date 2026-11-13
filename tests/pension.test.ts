import { describe, expect, it } from "vitest";
import { assetKey, isPensionFund, savingsType } from "@/lib/pension";

describe("pension helpers", () => {
  it("maps portal labels to asset types", () => {
    expect(savingsType("קרן השתלמות מיטב")).toBe("study_fund");
    expect(savingsType("קופת גמל להשקעה")).toBe("provident");
    expect(savingsType("קרן פנסיה מקיפה")).toBe("pension");
  });
  it("knows which funds are wired", () => {
    expect(isPensionFund("meitav")).toBe(true);
    expect(isPensionFund("altshuler")).toBe(false);
  });
  it("builds a stable asset key", () => {
    expect(assetKey(3, "123")).toBe("pension:3:123");
  });
});
