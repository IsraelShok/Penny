import { expect, it, vi } from "vitest";

// The real package starts a browser stack on import; the mapper needs none of it.
vi.mock("israeli-bank-scrapers", () => ({ CompanyTypes: {}, createScraper: () => ({}) }));

import { mapAccounts } from "@/server/scrapers/one-zero";

it("One Zero keeps the account balance and maps its transactions", () => {
  const mapped = mapAccounts({
    success: true,
    accounts: [
      {
        accountNumber: "12345",
        balance: 4321.5,
        txns: [
          {
            type: "normal",
            identifier: "m1",
            date: "2024-02-01",
            processedDate: "2024-02-01T10:00:00Z",
            originalAmount: -50,
            originalCurrency: "ILS",
            chargedAmount: -50,
            chargedCurrency: "ILS",
            description: "קפה",
            status: "completed",
          },
        ],
      },
      { accountNumber: "67890", txns: [] },
    ],
  } as unknown as Parameters<typeof mapAccounts>[0]); // the library's enums are mocked away above
  expect(mapped.map((a) => [a.accountNumber, a.balance])).toEqual([
    ["12345", 4321.5],
    ["67890", undefined],
  ]);
  expect(mapped[0].transactions).toEqual([
    {
      type: "normal",
      identifier: "m1",
      date: "2024-02-01",
      processedDate: "2024-02-01T10:00:00Z",
      originalAmount: -50,
      originalCurrency: "ILS",
      chargedAmount: -50,
      chargedCurrency: "ILS",
      description: "קפה",
      memo: undefined,
      installments: undefined,
      status: "completed",
    },
  ]);
});
