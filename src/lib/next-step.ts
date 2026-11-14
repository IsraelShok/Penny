import type { Allocation } from "./allocation";
import type { Suggestion } from "./suggestions";

export type TodayState = ReturnType<typeof import("./today-state").todayState>;
export type StepKind = "connect" | "sync" | "cash" | "buffer" | "stageItem" | "emergency" | "suggestion" | "invest" | "checkin" | "review" | "suggestions";
export interface Step { key: string; kind: StepKind; href: string; amount?: number; months?: number | null; stageId?: string; itemId?: string; dismissible: boolean }
export interface NextStepInput {
  today: TodayState;
  month: string;
  stage: { stageId: string; gentle: boolean } | null;
  stageItemId: string | null;
  alloc: Allocation | null;
  suggestions: Suggestion[];
  dismissed: ReadonlySet<string>;
}

const HIGH_VALUE = new Set<Suggestion["type"]>(["fees", "idle", "taxRefund", "interest", "fxMarkup"]);
const AHEAD = "/overview?tab=ahead";

/** One next step for Home, first match wins. Pure: text is resolved from `kind` by the UI. */
export function nextStep(i: NextStepInput): Step | null {
  const { today, month, stage, stageItemId, alloc, dismissed } = i;
  if (today === "loading" || today === "error") return null;
  if (today === "connect") return { key: "connect", kind: "connect", href: "/settings/bank", dismissible: false };
  if (today === "sync") return { key: "sync", kind: "sync", href: "/settings/bank", dismissible: false };
  if (today === "cash") return { key: "cash", kind: "cash", href: AHEAD, dismissible: false };

  const m = alloc?.monthly;
  const gentle = !!stage?.gentle;
  const stageItem: Step | null = stage && stageItemId
    ? { key: `stage:${stage.stageId}:${stageItemId}`, kind: "stageItem", href: "/life", stageId: stage.stageId, itemId: stageItemId, dismissible: true }
    : null;
  const candidates: (Step | null)[] = [
    m && m.liquid > 0 ? { key: `buffer:${month}`, kind: "buffer", href: AHEAD, amount: m.liquid, dismissible: true } : null,
    gentle ? stageItem : null,
  ];
  // A gentle stage (loss, etc.) never gets money nudges, even with no item left.
  if (!gentle) {
    const s = i.suggestions.find((x) => HIGH_VALUE.has(x.type) && !dismissed.has(x.key));
    candidates.push(
      m && m.moneyMarket > 0 ? { key: `emergency:${month}`, kind: "emergency", href: "/investments", amount: m.moneyMarket, months: alloc!.monthsToFull, dismissible: true } : null,
      stageItem,
      s ? { key: s.key, kind: "suggestion", href: "/checkin", dismissible: true } : null,
      m && m.market > 0 ? { key: `invest:${month}`, kind: "invest", href: "/investments", amount: m.market, dismissible: true } : null,
    );
  }
  const hit = candidates.find((c) => c && !dismissed.has(c.key));
  if (hit) return hit;

  if (today === "review") return { key: "review", kind: "review", href: "/transactions", dismissible: false };
  if (today === "checkin") return { key: "checkin", kind: "checkin", href: "/checkin", dismissible: false };
  if (today === "suggestions") return { key: "suggestions", kind: "suggestions", href: "/checkin", dismissible: false };
  return null;
}
