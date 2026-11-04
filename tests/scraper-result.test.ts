import { describe, it, expect } from "vitest";
import { toScrapeResult } from "@/server/scrapers/result";

const txn = {
  type: "normal",
  date: "2026-10-01T00:00:00.000Z",
  processedDate: "2026-11-10T00:00:00.000Z",
  originalAmount: -120,
  originalCurrency: "ILS",
  chargedAmount: -120,
  description: "שופרסל",
  status: "completed",
} as const;

const covered = { status: "covered", requestedStart: "2026-08-01", oldest: "2026-08-01" } as const;
const unproven = { status: "unproven", reason: "boundDidNotMove", requestedStart: "2026-08-01" } as const;

describe("toScrapeResult", () => {
  it("maps a covered account and its transactions", () => {
    const r = toScrapeResult({
      success: true,
      accounts: [{ accountNumber: "1234", txns: [txn], windowCoverage: covered }],
    });
    expect(r.success).toBe(true);
    expect(r.accounts[0].transactions).toHaveLength(1);
    expect(r.accounts[0].transactions[0].description).toBe("שופרסל");
  });

  it("fails the whole result when any account window is unproven", () => {
    const r = toScrapeResult({
      success: true,
      accounts: [
        { accountNumber: "1234", txns: [txn], windowCoverage: covered },
        { accountNumber: "5678", txns: [], windowCoverage: unproven },
      ],
    });
    expect(r.success).toBe(false);
    expect(r.accounts).toHaveLength(0);
    expect(r.errorMessage).toMatch(/5678/);
  });

  it("treats a missing windowCoverage as not assessed, not as failure", () => {
    const r = toScrapeResult({ success: true, accounts: [{ accountNumber: "1", txns: [txn] }] });
    expect(r.success).toBe(true);
  });

  it("maps pending status and installments", () => {
    const r = toScrapeResult({
      success: true,
      accounts: [{
        accountNumber: "1",
        txns: [{ ...txn, status: "pending", type: "installments", installments: { number: 2, total: 6 } }],
      }],
    });
    const t = r.accounts[0].transactions[0];
    expect(t.status).toBe("pending");
    expect(t.type).toBe("installments");
    expect(t.installments).toEqual({ number: 2, total: 6 });
  });
});
