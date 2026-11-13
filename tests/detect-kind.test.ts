import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { detectKind } from "@/server/lib/transfers";

describe("detectKind", () => {
  it("treats a loan deposit as a transfer, not income", () => {
    expect(detectKind("הלוואה מהבנק", "hapoalim", 20000)).toBe("transfer");
    expect(detectKind("Loan disbursement", "leumi", 5000)).toBe("transfer");
  });
  it("keeps salary as income and loan repayments as expenses", () => {
    expect(detectKind("משכורת", "hapoalim", 15000)).toBe("income");
    expect(detectKind("החזר הלוואה", "hapoalim", -1200)).toBe("expense");
  });
});
