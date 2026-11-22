import type { Fund, FundComparison } from "./types";

const median = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

/** Pension data has no track field, so the track is read from the name (most specific first). */
const PENSION_TRACKS = [
  /עוקב/,
  /מניות/,
  /הלכה/,
  /אג"ח|אשראי/,
  /50 ומטה/,
  /50 עד 60/,
  /60 ומעלה/,
  /כללי/,
];
const pensionTrack = (name: string) => PENSION_TRACKS.findIndex((re) => re.test(name));

/** Funds of the same kind: same classification and the same investment track. */
export function peersOf(fund: Fund, all: Fund[]): Fund[] {
  const track = (f: Fund) => (f.source === "pension" ? pensionTrack(f.name) : f.specialization);
  return all.filter(
    (f) =>
      f.source === fund.source &&
      f.classification === fund.classification &&
      track(f) === track(fund),
  );
}

export function compareFund(fund: Fund, all: Fund[]): FundComparison {
  const peers = peersOf(fund, all);
  const by5y = peers.filter((p) => p.avg5y != null).sort((a, b) => b.avg5y! - a.avg5y!);
  const rank = by5y.findIndex((p) => p.id === fund.id);
  return {
    fund,
    peers: {
      count: peers.length,
      feeBalance: median(peers.map((p) => p.feeBalance)),
      feeDeposit: median(peers.map((p) => p.feeDeposit)),
      avg5y: median(peers.map((p) => p.avg5y)),
      avg3y: median(peers.map((p) => p.avg3y)),
    },
    rank5y: rank >= 0 ? rank + 1 : null,
  };
}

/** Name search: every word must appear, biggest funds first. */
export function searchFunds(all: Fund[], query: string, limit = 20): Fund[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return all
    .filter((f) => words.every((w) => `${f.name} ${f.company}`.toLowerCase().includes(w)))
    .sort((a, b) => (b.totalAssets ?? 0) - (a.totalAssets ?? 0))
    .slice(0, limit);
}

/** Capital Market Authority comparison sites (Gemel-Net, Pensia-Net, Bituach-Net). Plain links, nothing fetched. */
export const CMA_SITES = {
  GemelNet: "https://gemelnet.cma.gov.il",
  PensiaNet: "https://pensyanet.cma.gov.il",
  BituachNet: "https://bituachnet.cma.gov.il",
} as const;
