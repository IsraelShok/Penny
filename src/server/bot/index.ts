import "server-only";

import { Bot } from "grammy";
import { handleCommand, splitMessage, SHORT_LABEL, FULL_LABEL, type BotConfig } from "./commands";
import { getBotConfig, linkChat } from "./config";

const HELP_INTRO = "בחרו תמונת מצב בכפתורים למטה.";
import { listAllWorkspaceIds } from "../lib/workspace-context";
import { israelToday } from "../lib/date-utils";
import { getActivitySnapshot } from "../sync/activity";
import { checkForUpdate, createUpdateNotifier } from "../update/check";

declare global {
  var __spentBot: Bot | undefined;
  var __spentUpdateCheck: boolean | undefined;
}

const KEYBOARD = { keyboard: [[{ text: SHORT_LABEL }, { text: FULL_LABEL }]], resize_keyboard: true, is_persistent: true };

/** Starts long polling when a bot is saved in settings (or in env); the first chat to send the link code becomes the owner. */
export function startBot(): void {
  const { token } = getBotConfig();
  if (!token || globalThis.__spentBot) return;
  const bot = new Bot(token);

  bot.on("message:text", async (ctx) => {
    const { chatId } = getBotConfig();
    const text = ctx.message.text.trim();
    if (!chatId) {
      const code = text.match(/^\/start\s+(\S+)$/)?.[1];
      if (code && linkChat(code, ctx.chat.id)) await ctx.reply(`מחובר. ${HELP_INTRO}`, { reply_markup: KEYBOARD });
      return;
    }
    const cfg: BotConfig = { chatId, billingDay: Number(process.env.CARD_BILLING_DAY) || 10 };
    const reply = await handleCommand(text, ctx.chat.id, cfg, {
      workspaceId: listAllWorkspaceIds()[0],
      today: israelToday(),
      isSyncRunning: () => getActivitySnapshot().sync.active,
      runSync: async () => {
        const { runAllWorkspaces } = await import("../sync/orchestrator");
        const summaries = await runAllWorkspaces(undefined, undefined, "manual");
        const added = summaries.reduce((s, w) => s + w.added, 0);
        const failed = summaries.flatMap((w) => w.providers).filter((p) => !p.ok);
        return failed.length
          ? `Sync finished with errors: ${failed.map((f) => f.label).join(", ")}`
          : `Sync done, ${added} new transactions`;
      },
    });
    if (reply) for (const part of splitMessage(reply)) await ctx.reply(part, { reply_markup: KEYBOARD });
  });

  bot.catch((err) => console.error("[bot]", err.message));
  globalThis.__spentBot = bot;
  void bot.start();
  if (!globalThis.__spentUpdateCheck) {
    globalThis.__spentUpdateCheck = true;
    scheduleUpdateCheck((text) => {
      const { chatId } = getBotConfig();
      const current = globalThis.__spentBot;
      return chatId && current ? current.api.sendMessage(chatId, text).then(() => undefined) : Promise.resolve();
    });
  }
}

/** Called after the bot is saved or removed in settings. */
export async function restartBot(): Promise<void> {
  const old = globalThis.__spentBot;
  globalThis.__spentBot = undefined;
  if (old) await old.stop().catch(() => undefined);
  startBot();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** With SPENT_UPDATE_CHECK=1, tells the user in Telegram when the tracked branch has a newer commit. Never installs anything. */
function scheduleUpdateCheck(send: (text: string) => Promise<void>): void {
  const current = process.env.SPENT_COMMIT ?? "";
  if (process.env.SPENT_UPDATE_CHECK !== "1" || !current || current === "unknown") return;

  const notify = createUpdateNotifier(send);
  const run = async () => {
    const info = await checkForUpdate({
      repo: process.env.SPENT_UPDATE_REPO || "Shaya16/Spent",
      branch: process.env.SPENT_UPDATE_BRANCH || "main",
      current,
    });
    if (info) await notify(info).catch((err) => console.error("[update]", err.message));
  };
  setTimeout(() => void run(), 60_000).unref();
  setInterval(() => void run(), DAY_MS).unref();
}
