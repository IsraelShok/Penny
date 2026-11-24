import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { connectOpenBanking, nextPageUrl } from "@/server/open-banking/client";

type Reply = { status?: number; body: unknown };
let handler: (url: string) => Reply = () => ({ body: {} });
let hits: string[] = [];
let base = "";

const server = http.createServer((req, res) => {
  hits.push(req.url ?? "");
  const { status = 200, body } = handler(req.url ?? "");
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
});

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => void server.close());

const run = (baseUrl = base) => {
  hits = [];
  return connectOpenBanking({ baseUrl, token: "test-token" }, new Date("2024-01-01"));
};
const accounts = {
  accounts: [
    {
      resourceId: "acc1",
      iban: "IL00TEST",
      balances: [
        { balanceType: "expected", balanceAmount: { amount: "1" } },
        { balanceType: "closingBooked", balanceAmount: { amount: "1234.5" } },
      ],
    },
  ],
};
const txn = (id: string) => ({
  transactionId: id,
  bookingDate: "2024-02-01",
  transactionAmount: { amount: "-10", currency: "ILS" },
});

describe("open banking client", () => {
  it("follows _links.next across pages and reads the balance", async () => {
    handler = (url) => {
      if (url.startsWith("/v1/accounts?")) return { body: accounts };
      if (url.includes("page=2")) return { body: { transactions: { booked: [txn("b")] } } };
      return {
        body: {
          transactions: {
            booked: [txn("a")],
            _links: { next: { href: "/v1/accounts/acc1/transactions?page=2" } },
          },
        },
      };
    };
    const result = await run();
    expect(result.success).toBe(true);
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].accountNumber).toBe("IL00TEST");
    expect(result.accounts[0].balance).toBe(1234.5);
    expect(result.accounts[0].transactions.map((t) => t.identifier)).toEqual(["a", "b"]);
  });

  it("fails instead of saving a partial history when the next links loop or never end", async () => {
    handler = (url) =>
      url.startsWith("/v1/accounts?")
        ? { body: accounts }
        : { body: { transactions: { booked: [txn("x")] }, _links: { next: url } } };
    const looping = await run();
    expect(looping.success).toBe(false);
    expect(hits).toHaveLength(2); // the account list + the page that points at itself

    hits.length = 0;
    let n = 0;
    handler = (url) =>
      url.startsWith("/v1/accounts?")
        ? { body: accounts }
        : { body: { transactions: { booked: [txn("x")] }, _links: { next: `${url}&p=${++n}` } } };
    const endless = await run();
    expect(endless.success).toBe(false);
    expect(hits).toHaveLength(51); // the account list + 50 pages, then it stops
  });

  it("refuses plain http to another machine without sending anything", async () => {
    const result = await run("http://bank.example");
    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/https:\/\//);
    expect(hits).toEqual([]);
  });

  it("tells the person to renew an expired consent", async () => {
    handler = () => ({ status: 401, body: { tppMessages: [{ code: "CONSENT_EXPIRED" }] } });
    const expired = await run();
    expect(expired.success).toBe(false);
    expect(expired.errorMessage).toMatch(/consent has expired or was revoked.*new access token/);
    expect(expired.retryable).toBe(false);

    // Some banks answer with another status and only the Berlin Group code.
    handler = () => ({ status: 400, body: { tppMessages: [{ code: "CONSENT_INVALID" }] } });
    expect((await run()).errorMessage).toMatch(/consent has expired or was revoked/);

    handler = () => ({ status: 404, body: {} });
    expect((await run()).errorMessage).not.toMatch(/consent/);
  });

  it("marks 503 and 429 as worth another attempt", async () => {
    for (const status of [503, 429]) {
      handler = () => ({ status, body: {} });
      const result = await run();
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    }
  });
});

describe("nextPageUrl", () => {
  const current = "https://bank.example/xs2a/v1/accounts/1/transactions?dateFrom=2024-01-01";
  it("reads a link as an object or a string, relative or absolute", () => {
    expect(nextPageUrl({ _links: { next: "?page=2" } }, current)).toBe(
      "https://bank.example/xs2a/v1/accounts/1/transactions?page=2",
    );
    expect(
      nextPageUrl(
        { transactions: { _links: { next: { href: "https://bank.example/p2" } } } },
        current,
      ),
    ).toBe("https://bank.example/p2");
    expect(nextPageUrl({ transactions: { booked: [] } }, current)).toBeNull();
  });

  it("never follows a link to another server, where the token would leak", () => {
    expect(() => nextPageUrl({ _links: { next: "https://evil.example/p2" } }, current)).toThrow(
      /different server/,
    );
  });
});
