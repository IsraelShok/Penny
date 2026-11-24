import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MCP_READ_PATHS } from "@/proxy";
import {
  callApi,
  dataDir,
  formatBalanceForecast,
  formatCashAhead,
  formatCashflowHealth,
  formatInsights,
  formatInsurance,
  formatPension,
  formatSyncStatus,
  TOOL_HANDLERS,
  formatBudgets,
  formatNetWorth,
  formatOverview,
  formatTransactions,
  formatUpcoming,
  handleMessage,
  TOOLS,
} from "../scripts/mcp.mjs";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: { type: string };
}

/** The reply shape these tests look at. A message with an id always gets one. */
interface RpcReply {
  result?: {
    protocolVersion?: string;
    capabilities?: unknown;
    serverInfo?: { name: string; version: string };
    tools?: ToolDescriptor[];
    content?: { type: string; text: string }[];
    isError?: boolean;
  };
  error?: { code: number; message: string };
}

const rpc = (reply: unknown) => reply as RpcReply | null;

describe("MCP tool formatting", () => {
  it("sums up a period with each category's share of the spending", () => {
    const text = formatOverview({
      period: { from: "2026-11-01", to: "2026-11-30" },
      totals: { income: 20000, expenses: 8000, net: 12000, savingsRate: 0.6 },
      byCost: { fixed: 5000, variable: 2500, unplanned: 500 },
      uncategorized: 250,
      categories: [
        { name: "Food", spent: 6000, previous: 5000 },
        { name: "Transport", spent: 2000, previous: 0 },
        { name: "Unused", spent: 0, previous: 0 },
      ],
    });
    expect(text).toContain("Income: ₪20,000");
    expect(text).toContain("Net: ₪12,000 (savings rate 60%)");
    expect(text).toContain("fixed ₪5,000");
    expect(text).toContain("Still uncategorized: ₪250");
    expect(text).toContain("- Food: ₪6,000 (75% of spending) · previous period ₪5,000");
    expect(text).toContain("- Transport: ₪2,000 (25% of spending)");
    expect(text).not.toContain("Unused");
  });

  it("prints transactions with their sign, category and account, and says when it cut the list", () => {
    const text = formatTransactions({
      total: 40,
      transactions: [
        {
          date: "2026-11-03",
          chargedAmount: -42.5,
          description: "Supermarket",
          categoryName: "Food",
          accountLabel: "Visa 1234",
          kind: "expense",
        },
        {
          date: "2026-11-01",
          chargedAmount: 9000,
          description: "Salary",
          categoryName: null,
          provider: "hapoalim",
          kind: "income",
        },
      ],
    });
    expect(text).toContain("2026-11-03  −₪43  Supermarket  [Food · Visa 1234 · expense]");
    expect(text).toContain("uncategorized · hapoalim · income");
    expect(text).toContain("Showing 2 of 40");
    expect(formatTransactions({ transactions: [], total: 0 })).toBe(
      "No transactions match that filter.",
    );
  });

  it("lists only the categories that have a budget, with what is left", () => {
    const text = formatBudgets({
      periodTotal: 3000,
      totalBudget: 7000,
      uncategorized: 120,
      categoriesWithData: [
        {
          categoryName: "Food",
          spent: 1200,
          budget: 2000,
          remaining: 800,
          percentSpent: 60,
          isParent: false,
        },
        { categoryName: "Tracking only", spent: 500, budget: 0, remaining: 0, isParent: false },
        { categoryName: "Parent rollup", spent: 900, budget: 900, remaining: 0, isParent: true },
      ],
    });
    expect(text).toContain("Spent so far in this household month: ₪3,000 of a ₪7,000 target");
    expect(text).toContain("- Food: spent ₪1,200 of ₪2,000 (60% used, ₪800 left)");
    expect(text).not.toContain("Tracking only");
    expect(text).not.toContain("Parent rollup");
  });

  it("reports net worth and its largest holdings", () => {
    const text = formatNetWorth({
      totals: {
        assets: 500000,
        liquid: 120000,
        liabilities: 200000,
        deferredTax: 1500,
        netWorth: 298500,
        liquidNetWorth: 100000,
      },
      assets: [
        { name: "Apartment", type: "real_estate", valueIls: 400000, liquid: false },
        { name: "Brokerage", type: "stock", valueIls: 90000, liquid: true },
      ],
    });
    expect(text).toContain("Net worth: ₪298,500");
    expect(text).toContain("Assets: ₪500,000 (liquid ₪120,000) · Liabilities: ₪200,000");
    expect(text).toContain("Deferred tax on unrealised gains: ₪1,500");
    expect(text.indexOf("Apartment")).toBeLessThan(text.indexOf("Brokerage"));
  });

  it("sorts the upcoming payments and flags the overdue ones", () => {
    const text = formatUpcoming({
      totals: { planned: 9000, matched: 0, overdue: 1500, upcoming: 7500 },
      items: [
        {
          status: "planned",
          description: "Laptop",
          overdue: true,
          nextPayment: { date: "2026-11-01", chargeDate: "2026-11-10", amount: 1500 },
        },
        {
          status: "planned",
          description: "Flight",
          overdue: false,
          nextPayment: { date: "2026-12-01", chargeDate: "2026-12-10", amount: 7500 },
        },
        {
          status: "matched",
          description: "Already bought",
          overdue: false,
          nextPayment: { date: "2026-11-20", chargeDate: "2026-11-20", amount: 300 },
        },
      ],
    });
    expect(text).toContain("Planned purchases: ₪9,000 · still upcoming ₪7,500 · overdue ₪1,500");
    expect(text.indexOf("Laptop")).toBeLessThan(text.indexOf("Flight"));
    expect(text).toContain("2026-11-10  Laptop  ₪1,500 · overdue");
    expect(text).not.toContain("Already bought");
  });
});

describe("MCP tool formatting: what is ahead, insights, pension, insurance, sync", () => {
  it("reports the low point of the balance forecast", () => {
    const text = formatBalanceForecast({
      forecast: {
        points: Array.from({ length: 15 }, (_, i) => ({
          date: `2026-12-${String(i + 1).padStart(2, "0")}`,
          balance: 5000 - i * 500,
        })),
        low: { date: "2026-12-15", balance: -2000 },
        firstNegative: "2026-12-12",
        nextPayday: "2027-01-01",
      },
    });
    expect(text).toContain("Lowest expected bank balance: −₪2,000 on 2026-12-15");
    expect(text).toContain("below zero on 2026-12-12");
    expect(text).toContain("- 2026-12-08: ₪1,500");
    expect(formatBalanceForecast({ forecast: null })).toContain("no forecast");
  });

  it("says what is free to spend until payday", () => {
    const text = formatCashAhead({
      safeToSpend: 3200,
      bank: 9000,
      billsDue: 5800,
      salaryExpected: 15000,
      until: "2026-12-10",
      daysLeft: 17,
    });
    expect(text).toContain("Free to spend until 2026-12-10 (17 days): ₪3,200");
    expect(text).toContain("card bills due before then: ₪5,800");
    expect(formatCashAhead({ safeToSpend: null })).toContain("No bank account");
  });

  it("names the cash flow warning signs in words", () => {
    const text = formatCashflowHealth({
      hasData: true,
      level: "watch",
      signs: ["overdraft"],
      avgIncome: 20000,
      avgExpenses: 21000,
      facts: { liquid: 500 },
    });
    expect(text).toContain("Cash flow: watch");
    expect(text).toContain("- overdraft interest");
    expect(formatCashflowHealth({ hasData: false })).toContain("not enough");
  });

  it("lists recurring charges, card bills and anomalies", () => {
    const text = formatInsights({
      series: [
        { merchant: "Gym", expectedAmount: 250, cadence: "monthly", lastDate: "2026-11-02" },
        {
          merchant: "Streaming",
          expectedAmount: 60,
          cadence: "monthly",
          lastDate: "2026-11-05",
          priceChange: { from: 50, to: 60, date: "2026-11-05" },
        },
      ],
      forecast: [{ date: "2026-12-10", account: "1234", total: 4200 }],
      anomalies: [{ type: "duplicate_charge", detail: "Two identical charges at Cafe" }],
    });
    expect(text.indexOf("Gym")).toBeLessThan(text.indexOf("Streaming"));
    expect(text).toContain("price changed from ₪50 to ₪60 on 2026-11-05");
    expect(text).toContain("- 2026-12-10 (card 1234): ₪4,200");
    expect(text).toContain("- Two identical charges at Cafe");
    expect(formatInsights({})).toContain("No recurring charges");
  });

  it("sums up pension, insurance and the sync state", () => {
    const pension = formatPension(
      { connections: [{ fundId: "menora", lastSyncAt: null, lastError: null, state: "idle" }] },
      { reports: [{ asOf: "2026-09-30", totalSavings: 410000, products: 3, member: "" }] },
    );
    expect(pension).toContain("- 2026-09-30: total savings ₪410,000 across 3 products");
    expect(pension).toContain("- menora: last synced never (idle)");

    const insurance = formatInsurance({
      totals: { monthly: 300, paidLast12: 3600 },
      policies: [
        {
          name: "Car",
          kind: "car",
          provider: "Insurer",
          monthlyPremium: 300,
          renewalMonth: "2027-01",
          renewalSoon: true,
          archived: false,
        },
        { name: "Old", kind: "home", monthlyPremium: 50, archived: true },
      ],
      unlinked: [{}],
    });
    expect(insurance).toContain("- Car (car, Insurer): ₪300 a month · renews 2027-01 (soon)");
    expect(insurance).not.toContain("Old");
    expect(insurance).toContain("1 insurance-looking charges");

    expect(
      formatSyncStatus({
        sync: { active: true, kind: "scheduled", since: "2026-11-23T06:00:00.000Z", stale: false },
        scheduler: { armed: true, nextRunAt: "2026-11-24T06:00:00.000Z" },
      }),
    ).toBe(
      "A scheduled sync is running since 2026-11-23T06:00:00.000Z.\nNext automatic sync: 2026-11-24T06:00:00.000Z",
    );
  });
});

describe("MCP and the app lock", () => {
  const TOKEN = "ab".repeat(32);
  type Init = { headers?: Record<string, string> };
  const base = { baseUrl: "http://127.0.0.1:41234" };

  it("only ever GETs routes the proxy's token allowlist names", async () => {
    const seen: { path: string; method: string }[] = [];
    const fetchImpl = async (url: string, init?: Init & { method?: string }) => {
      seen.push({ path: new URL(url).pathname, method: init?.method ?? "GET" });
      return jsonResponse({});
    };
    for (const handler of Object.values(TOOL_HANDLERS))
      await (handler as (a: unknown, d: unknown) => Promise<string>)({}, { ...base, fetchImpl });
    expect(seen.length).toBeGreaterThanOrEqual(TOOLS.length);
    for (const call of seen) {
      expect(call.method).toBe("GET");
      expect(MCP_READ_PATHS.has(call.path), call.path).toBe(true);
    }
    expect(new Set(seen.map((c) => c.path))).toEqual(new Set(MCP_READ_PATHS));
  });

  it("sends the token from the data folder, and nothing when there is none", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-mcp-"));
    const tokenFile = path.join(dir, "mcp-token");
    const seen: (string | null)[] = [];
    const fetchImpl = async (_url: string, init?: Init) => {
      seen.push(init?.headers?.["x-penny-mcp-token"] ?? null);
      return jsonResponse({});
    };
    await callApi("/api/assets", { ...base, fetchImpl, tokenFile });
    await callApi("/api/assets", { ...base, fetchImpl });
    fs.writeFileSync(tokenFile, "not a token");
    await callApi("/api/assets", { ...base, fetchImpl, tokenFile });
    fs.writeFileSync(tokenFile, `${TOKEN}\n`);
    await callApi("/api/assets", { ...base, fetchImpl, tokenFile });
    expect(seen).toEqual([null, null, null, TOKEN]);
  });

  it("tries once more when the locked app has just written the token", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-mcp-"));
    const tokenFile = path.join(dir, "mcp-token");
    let calls = 0;
    const fetchImpl = async (_url: string, init?: Init) => {
      calls += 1;
      if (init?.headers?.["x-penny-mcp-token"] === TOKEN) return jsonResponse({ ok: true });
      fs.writeFileSync(tokenFile, TOKEN);
      return jsonResponse({ error: "locked" }, 401);
    };
    expect(await callApi("/api/assets", { ...base, fetchImpl, tokenFile })).toEqual({ ok: true });
    expect(calls).toBe(2);

    // A token the app refuses is not retried forever.
    calls = 0;
    const refuse = async () => {
      calls += 1;
      return jsonResponse({ error: "locked" }, 401);
    };
    await expect(callApi("/api/assets", { ...base, fetchImpl: refuse, tokenFile })).rejects.toThrow(
      /locked/,
    );
    expect(calls).toBe(1);
  });

  it("finds the data folder the way the app does", () => {
    expect(dataDir({ PENNY_DATA_DIR: "some/dir" })).toBe(path.resolve("some/dir"));
    expect(dataDir({})).toBe(path.resolve(__dirname, "..", "data"));
    const desktop = dataDir({
      PENNY_INSTALL: "desktop",
      APPDATA: "C:\\AppData",
      XDG_CONFIG_HOME: "/cfg",
    });
    expect(desktop.endsWith(path.join("Penny", "data"))).toBe(true);
  });
});

describe("MCP protocol", () => {
  it("answers initialize in the client's protocol version and never claims write access", async () => {
    const reply = rpc(
      await handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05" },
      }),
    );
    expect(reply?.result?.protocolVersion).toBe("2024-11-05");
    expect(reply?.result?.serverInfo?.name).toBe("penny");
    expect(reply?.result?.capabilities).toEqual({ tools: { listChanged: false } });
  });

  it("falls back to its own protocol version for one it does not know", async () => {
    const reply = rpc(
      await handleMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "1999-01-01" },
      }),
    );
    expect(reply?.result?.protocolVersion).toBe("2025-06-18");
  });

  it("lists every read tool with a JSON schema", async () => {
    const reply = rpc(await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
    const tools = reply?.result?.tools ?? [];
    expect(tools).toHaveLength(TOOLS.length);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it("stays silent on notifications", async () => {
    expect(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
    expect(
      await handleMessage({ jsonrpc: "2.0", method: "notifications/cancelled", params: {} }),
    ).toBeNull();
  });

  it("rejects an unknown tool and an unknown method", async () => {
    const unknownTool = rpc(
      await handleMessage({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "delete_everything" },
      }),
    );
    expect(unknownTool?.error?.code).toBe(-32602);
    const unknownMethod = rpc(
      await handleMessage({ jsonrpc: "2.0", id: 4, method: "resources/list" }),
    );
    expect(unknownMethod?.error?.code).toBe(-32601);
  });

  it("asks the running app and returns its answer as text", async () => {
    const fetchImpl = async () =>
      jsonResponse({
        periodTotal: 10,
        totalBudget: 0,
        uncategorized: 0,
        categoriesWithData: [],
      });
    const reply = rpc(
      await handleMessage(
        {
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: { name: "penny_budgets", arguments: {} },
        },
        { baseUrl: "http://127.0.0.1:41234", fetchImpl },
      ),
    );
    expect(reply?.result?.isError).toBe(false);
    expect(reply?.result?.content?.[0]?.text).toContain(
      "Spent so far in this household month: ₪10",
    );
  });

  it("turns an app failure into a readable tool error instead of a crash", async () => {
    const reply = rpc(
      await handleMessage(
        {
          jsonrpc: "2.0",
          id: 6,
          method: "tools/call",
          params: { name: "penny_net_worth", arguments: {} },
        },
        {
          baseUrl: "http://127.0.0.1:41234",
          fetchImpl: async () => jsonResponse({ error: "locked" }, 401),
        },
      ),
    );
    expect(reply?.result?.isError).toBe(true);
    expect(reply?.result?.content?.[0]?.text).toContain("locked");
  });

  it("explains an app that is not running at all", async () => {
    await expect(
      callApi("/api/assets", {
        baseUrl: "http://127.0.0.1:41234",
        fetchImpl: async () => {
          throw new Error("ECONNREFUSED");
        },
      }),
    ).rejects.toThrow(/Penny is not answering at http:\/\/127\.0\.0\.1:41234/);
  });

  it("sends the workspace header only when one was chosen", async () => {
    const seen: (string | null)[] = [];
    const fetchImpl = async (_url: string, init?: { headers?: Record<string, string> }) => {
      seen.push(init?.headers?.["x-workspace-id"] ?? null);
      return jsonResponse({});
    };
    await callApi("/api/assets", { baseUrl: "http://127.0.0.1:41234", fetchImpl });
    await callApi("/api/assets", { baseUrl: "http://127.0.0.1:41234", fetchImpl, workspaceId: 3 });
    expect(seen).toEqual([null, "3"]);
  });
});
