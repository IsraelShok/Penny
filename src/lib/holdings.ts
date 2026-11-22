import type { Asset, AssetType } from "./types";

/** Types whose value moves with a market. Shown under "ערך משתנה", never as cash. */
export const VOLATILE_TYPES: AssetType[] = ["stock", "fund", "bond", "crypto", "metal"];

export const isVolatile = (a: Asset) =>
  !a.isLiability && a.source !== "bank" && (a.symbol != null || VOLATILE_TYPES.includes(a.type));

/**
 * From daily snapshots (oldest first) and today's value: when the current value began, and the change from the value before it.
 * Snapshots within 1 agora count as equal.
 */
export function lastChange(snaps: { date: string; valueIls: number }[], current: number | null) {
  if (current == null) return null;
  let i = snaps.length;
  while (i > 0 && Math.abs(snaps[i - 1].valueIls - current) < 0.01) i--;
  const since = snaps[i]?.date ?? null;
  const prev = snaps[i - 1];
  if (!prev) return { since, prevIls: null, changeIls: null, changePct: null };
  const changeIls = current - prev.valueIls;
  return {
    since,
    prevIls: prev.valueIls,
    changeIls,
    changePct: prev.valueIls ? changeIls / prev.valueIls : null,
  };
}
