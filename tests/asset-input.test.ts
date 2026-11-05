import { describe, expect, it } from "vitest";
import { parseAssetInput } from "@/lib/asset-input";

describe("parseAssetInput", () => {
  it("accepts a live-priced holding and drops the manual value", () => {
    const a = parseAssetInput({ name: " Apple ", type: "stock", symbol: "aapl", quantity: "10", manualValue: 5 });
    expect(a).toMatchObject({ name: "Apple", symbol: "AAPL", quantity: 10, manualValue: null, currency: "ILS", liquid: true });
  });

  it("accepts a hand-valued asset", () => {
    expect(parseAssetInput({ name: "Pension", type: "pension", manualValue: 250000, liquid: false })).toMatchObject({ liquid: false, symbol: null });
  });

  it("rejects bad input", () => {
    expect(parseAssetInput({ type: "stock", manualValue: 1 })).toBe("name is required");
    expect(parseAssetInput({ name: "X", type: "yacht", manualValue: 1 })).toMatch(/invalid type/);
    expect(parseAssetInput({ name: "X", type: "stock", symbol: "AAPL" })).toMatch(/quantity is required/);
    expect(parseAssetInput({ name: "X", type: "cash" })).toMatch(/value or a symbol/);
    expect(parseAssetInput({ name: "X", type: "cash", manualValue: -5 })).toMatch(/positive/);
  });
});
