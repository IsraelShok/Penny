import "server-only";

import { listAccountBalances, listAssets, netWorthHistory, saveDailyNetWorth, saveSnapshots } from "../db/queries/assets";
import { BANK_PROVIDERS } from "@/lib/types";
import { fxRate, getQuotes } from "./quotes";
import { BENCHMARKS } from "@/lib/markets";
import { toLocalISODate } from "../lib/date-utils";
import type { Asset, AssetsPayload, AssetType, Fund, FundSource } from "@/lib/types";
import { loadFunds } from "./funds";
import { compareFund } from "@/lib/funds";

/** Israeli capital gains tax on realised profit. */
const CAPITAL_GAINS_TAX = 0.25;
/** Tax-sheltered or taxed differently: no deferred capital gains tax. */
const UNTAXED: AssetType[] = ["pension", "study_fund", "provident", "real_estate", "vehicle", "cash", "deposit"];

export async function getAssetsPayload(workspaceId: number): Promise<AssetsPayload> {
  const rows = listAssets(workspaceId);
  const currencies = [...new Set(rows.map((r) => r.currency).filter((c) => c !== "ILS"))];
  const quotes = await getQuotes([
    ...rows.flatMap((r) => (r.symbol ? [r.symbol] : [])),
    ...currencies.map((c) => `${c}ILS=X`),
    ...BENCHMARKS,
  ]);

  // Public fund data, only fetched when some asset is linked to a fund.
  const fundLists = new Map<FundSource, Fund[]>();
  for (const s of new Set(rows.flatMap((r) => (r.fundId && r.fundSource ? [r.fundSource] : [])))) fundLists.set(s, await loadFunds(s));
  const fundOf = (r: (typeof rows)[number]) => {
    const list = r.fundSource ? fundLists.get(r.fundSource) : undefined;
    const fund = list?.find((f) => f.id === r.fundId);
    return fund && list ? compareFund(fund, list) : null;
  };

  const assets: Asset[] = rows.map((r) => {
    const quote = r.symbol ? quotes.get(r.symbol.trim().toUpperCase()) ?? null : null;
    // A live price wins; the quote's own currency (e.g. USD for AAPL) overrides the row's.
    const currency = quote?.currency ?? r.currency;
    const value = quote && r.quantity != null ? quote.price * r.quantity : r.manualValue;
    const rate = fxRate(currency, quotes);
    const valueIls = value != null && rate != null ? value * rate : null;
    const costRate = fxRate(r.currency, quotes);
    const gainIls =
      valueIls != null && r.costBasis != null && costRate != null ? valueIls - r.costBasis * costRate : null;
    return { ...r, currency, value, valueIls, gainIls, quote, fund: fundOf(r) };
  });

  // Synced bank balances, as cash (an overdrawn account counts as a short-term debt).
  for (const b of listAccountBalances(workspaceId)) {
    const bank = BANK_PROVIDERS.find((p) => p.id === b.provider)?.name ?? b.provider;
    const overdrawn = b.balance < 0;
    assets.push({
      id: -b.id,
      name: `${bank} · ${b.accountNumber.slice(-4)}`,
      type: overdrawn ? "credit" : "cash",
      currency: "ILS",
      symbol: null,
      quantity: null,
      manualValue: Math.abs(b.balance),
      costBasis: null,
      liquid: true,
      note: null,
      feeDeposit: null,
      feeBalance: null,
      monthlyDeposit: null,
      interestRate: null,
      monthlyPayment: null,
      isLiability: overdrawn,
      value: Math.abs(b.balance),
      valueIls: Math.abs(b.balance),
      gainIls: null,
      quote: null,
      source: "bank",
      updatedAt: b.updatedAt,
    });
  }

  let total = 0, liquid = 0, liabilities = 0, mortgages = 0, deferredTax = 0;
  for (const a of assets) {
    const v = a.valueIls ?? 0;
    if (a.isLiability) {
      liabilities += v;
      if (a.type === "mortgage") mortgages += v;
      continue;
    }
    total += v;
    if (a.liquid) liquid += v;
    if (a.gainIls != null && a.gainIls > 0 && !UNTAXED.includes(a.type)) deferredTax += a.gainIls * CAPITAL_GAINS_TAX;
  }

  saveSnapshots(
    toLocalISODate(new Date()),
    assets.flatMap((a) => (a.valueIls != null && a.id > 0 ? [{ assetId: a.id, valueIls: a.valueIls }] : []))
  );

  const netWorth = total - liabilities - deferredTax;
  saveDailyNetWorth(workspaceId, toLocalISODate(new Date()), netWorth);

  return {
    assets,
    totals: {
      assets: total,
      liquid,
      liabilities,
      deferredTax,
      netWorth,
      // Mortgage payments are already in monthly spending, which the FI target funds; subtracting the balance too would count it twice.
      liquidNetWorth: liquid - (liabilities - mortgages) - deferredTax,
    },
    history: netWorthHistory(workspaceId),
    benchmarks: BENCHMARKS.map((s) => {
      const q = quotes.get(s.toUpperCase());
      return { symbol: s, change12m: q?.change12m ?? null, changeYtd: q?.changeYtd ?? null };
    }),
  };
}
