import "server-only";

import { loadInsights } from "../insights/data";
import { forecastCards } from "../insights/forecast";
import { getLastSyncRun } from "../db/queries/sync-runs";
import { buildSnapshot, formatFull, formatShort } from "./snapshot";

export interface BotConfig {
  chatId: number;
  billingDay: number;
  /** "Hide amounts in Telegram": amounts become dots, since messages sit on Telegram's servers. */
  hideAmounts?: boolean;
}

export interface BotDeps {
  /** Undefined until the app has been set up. */
  workspaceId: number | undefined;
  today: string;
  runSync: () => Promise<string>;
  isSyncRunning?: () => boolean;
}

const showMoney = (n: number) => `₪${Math.round(n).toLocaleString("en-US")}`;
export const HIDDEN_AMOUNT = "•••";

/** Reply-keyboard labels; tapping one sends its text, mapped back to a command. */
export const SHORT_LABEL = "תמונת מצב מצומצמת";
export const FULL_LABEL = "תמונת מצב מלאה";
export const MENU_LABEL = "☰ תפריט";
const ALIASES: Record<string, string> = { [MENU_LABEL]: "/short", [SHORT_LABEL]: "/short", [FULL_LABEL]: "/full", "קצר": "/short", "מלא": "/full" };

/** Inline tabs under every card; tapping one edits the same message instead of sending a new one. */
export const MENU_TABS: [label: string, cmd: string][] = [
  ["💰 מצב", "/short"], ["📊 החודש", "/month"], ["📅 חיובים", "/forecast"], ["🔁 מנויים", "/subs"],
  ["🏷 סיווג", "/categorize"], ["📋 הכל", "/full"], ["⟳ סנכרון", "/sync"],
];
export const MENU_PREFIX = "m:";

/** Four tabs over three; the open tab is marked so the card reads like a tab bar. */
export function menuMarkup(active?: string) {
  // Categorize opens its own card flow (bot/categorize.ts), not a text reply.
  const data = (cmd: string) => (cmd === "/categorize" ? "c:s:0" : MENU_PREFIX + cmd);
  const btn = ([label, cmd]: [string, string]) => ({ text: cmd === active ? `· ${label} ·` : label, callback_data: data(cmd) });
  return { inline_keyboard: [MENU_TABS.slice(0, 4).map(btn), MENU_TABS.slice(4).map(btn)] };
}

/** Telegram's "/" menu, in Hebrew. */
export const BOT_COMMANDS = [
  { command: "menu", description: "תפריט ותמונת מצב" },
  { command: "month", description: "הוצאות החודש" },
  { command: "forecast", description: "חיובי אשראי צפויים" },
  { command: "subs", description: "מנויים" },
  { command: "categorize", description: "סיווג עסקאות" },
  { command: "sync", description: "סנכרון עכשיו" },
];

const HELP = [
  "בחרו תמונת מצב בכפתורים למטה, או:",
  "/short - תמונת מצב מצומצמת",
  "/full - תמונת מצב מלאה",
  "/month - this month's spending",
  "/subs - detected subscriptions",
  "/forecast - next 3 card bills",
  "/status - last sync",
  "/sync - sync now",
].join("\n");

// Telegram rejects messages over 4096 characters.
const TELEGRAM_LIMIT = 4000;

/** Splits a reply into Telegram-sized parts, on line breaks where possible. */
export function splitMessage(text: string, max = TELEGRAM_LIMIT): string[] {
  const parts: string[] = [];
  let current: string | null = null;
  for (const line of text.split("\n")) {
    // Split by code point so an emoji is never cut in half.
    const chars = Array.from(line);
    const pieces: string[] = [];
    for (let i = 0; i < chars.length; i += max) pieces.push(chars.slice(i, i + max).join(""));
    if (pieces.length === 0) pieces.push("");
    for (const piece of pieces) {
      if (current !== null && current.length + 1 + piece.length <= max) {
        current += `\n${piece}`;
      } else {
        if (current !== null) parts.push(current);
        current = piece;
      }
    }
  }
  if (current !== null) parts.push(current);
  // Telegram rejects an empty message.
  return parts.filter((p) => p.trim().length > 0);
}

/** Returns the reply text, or null when the message is not from the configured chat. */
export async function handleCommand(
  text: string,
  fromChatId: number,
  cfg: BotConfig,
  deps: BotDeps
): Promise<string | null> {
  if (fromChatId !== cfg.chatId) return null;
  const cmd = ALIASES[text.trim()] ?? text.trim().split(/\s+/)[0].toLowerCase().replace(/@.*$/, "");
  const money = cfg.hideAmounts ? () => HIDDEN_AMOUNT : showMoney;
  const hide = !!cfg.hideAmounts;
  const workspaceId = deps.workspaceId;
  if (workspaceId === undefined) return "Spent is not set up yet. Finish setup in the app first.";

  switch (cmd) {
    case "/start":
    case "/menu":
    case "/short":
      return formatShort(buildSnapshot(workspaceId, deps.today), hide);
    case "/full":
      return formatFull(buildSnapshot(workspaceId, deps.today), hide);
    case "/month": {
      const i = loadInsights(workspaceId, deps.today);
      const lines = i.topCategories.map((c) => `${c.name}: ${money(c.total)}`);
      return [`Spent this month: ${money(i.monthTotal)}`, ...lines].join("\n");
    }
    case "/subs": {
      const i = loadInsights(workspaceId, deps.today);
      if (i.series.length === 0) return "No subscriptions detected yet.";
      return i.series
        .map((s) => {
          const change = s.priceChange ? ` (price ${money(s.priceChange.from)} -> ${money(s.priceChange.to)})` : "";
          return `${s.merchant} ${money(s.expectedAmount)} ${s.cadence}${s.status === "candidate" ? " [maybe]" : ""}${change}`;
        })
        .join("\n");
    }
    case "/forecast": {
      const i = loadInsights(workspaceId, deps.today, cfg.billingDay);
      const forecast = forecastCards({ today: deps.today, cards: i.cards, series: i.series, installments: i.installments });
      if (forecast.length === 0) return "No card activity yet.";
      return forecast
        .map(
          (f) =>
            `${f.date} card ${f.account?.slice(-4)}: ${money(f.total)} (posted ${money(f.parts.posted)}, recurring ${money(f.parts.recurring)}, installments ${money(f.parts.installments)}, other ${money(f.parts.discretionary)})`
        )
        .join("\n");
    }
    case "/status": {
      const run = getLastSyncRun(workspaceId);
      return run ? `Last sync: ${run.status} at ${run.startedAt}` : "No sync yet.";
    }
    case "/sync":
      // Two syncs at once hit the bank twice and race on the same rows.
      if (deps.isSyncRunning?.()) return "A sync is already running. Try again when it finishes.";
      return deps.runSync();
    default:
      return HELP;
  }
}
