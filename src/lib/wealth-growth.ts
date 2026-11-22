import type { Asset } from "@/lib/types";

export type WealthGroup = "portfolio" | "pension" | "funds";

const GROUP: Partial<Record<Asset["type"], WealthGroup>> = {
  stock: "portfolio",
  fund: "portfolio",
  bond: "portfolio",
  crypto: "portfolio",
  metal: "portfolio",
  pension: "pension",
  study_fund: "funds",
  provident: "funds",
};

/**
 * Estimated ₪ growth over the last month, or null when there is nothing to estimate from.
 * shortcut: market assets use the weekly close ~4 weeks back; pension/study funds spread the
 * fund's public YTD yield evenly over the reported months. Upgrade to per-asset value history once stored.
 */
export function monthlyGrowth(a: Asset): number | null {
  if (a.valueIls == null) return null;
  const s = a.quote?.series;
  if (s && s.length >= 5) {
    const now = s[s.length - 1],
      then = s[s.length - 5];
    return then > 0 && now > 0 ? a.valueIls * (1 - then / now) : null;
  }
  const f = a.fund?.fund;
  if (f?.ytd != null && f.period % 100 > 0) {
    const m = f.ytd / 100 / (f.period % 100);
    return a.valueIls * (m / (1 + m));
  }
  return null;
}

export function wealthGroups(assets: Asset[]) {
  const out: Record<WealthGroup, { value: number; growth: number; estimated: boolean }> = {
    portfolio: { value: 0, growth: 0, estimated: false },
    pension: { value: 0, growth: 0, estimated: false },
    funds: { value: 0, growth: 0, estimated: false },
  };
  for (const a of assets) {
    const g = !a.isLiability && GROUP[a.type];
    if (!g || a.valueIls == null) continue;
    out[g].value += a.valueIls;
    const d = monthlyGrowth(a);
    if (d != null) {
      out[g].growth += d;
      out[g].estimated = true;
    }
  }
  return out;
}
