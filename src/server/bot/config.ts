import "server-only";

import crypto from "crypto";
import { getGlobalSetting, setGlobalSetting, deleteGlobalSetting } from "../db/queries/settings";
import { encrypt, decrypt } from "../lib/encryption";

const TOKEN = "telegram_token";
const CHAT = "telegram_chat_id";
const CODE = "telegram_link_code";
const USERNAME = "telegram_bot_username";

/** Token and linked chat: saved in settings (token encrypted), falling back to TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID. */
export function getBotConfig(): { token: string | null; chatId: number | null; username: string | null; code: string | null } {
  const raw = getGlobalSetting(TOKEN);
  let token = process.env.TELEGRAM_BOT_TOKEN || null;
  if (raw) {
    const d = JSON.parse(raw) as Record<"e" | "i" | "t", string>;
    token = decrypt({ encrypted: Buffer.from(d.e, "base64"), iv: Buffer.from(d.i, "base64"), authTag: Buffer.from(d.t, "base64") });
  }
  const chat = Number(getGlobalSetting(CHAT) ?? process.env.TELEGRAM_CHAT_ID);
  return { token, chatId: chat || null, username: getGlobalSetting(USERNAME), code: getGlobalSetting(CODE) };
}

/** Saves a new bot; the old chat link no longer applies, so a fresh one-time link code is issued. */
export function saveBot(token: string, username: string): void {
  const { encrypted, iv, authTag } = encrypt(token);
  setGlobalSetting(TOKEN, JSON.stringify({ e: encrypted.toString("base64"), i: iv.toString("base64"), t: authTag.toString("base64") }));
  setGlobalSetting(USERNAME, username);
  setGlobalSetting(CODE, crypto.randomBytes(6).toString("hex"));
  deleteGlobalSetting(CHAT);
}

/** Links the chat that sent the matching one-time code; the code is then spent. */
export function linkChat(code: string, chatId: number): boolean {
  const expected = getGlobalSetting(CODE);
  if (!expected || code.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expected))) return false;
  setGlobalSetting(CHAT, String(chatId));
  deleteGlobalSetting(CODE);
  return true;
}

export function clearBot(): void {
  for (const k of [TOKEN, CHAT, CODE, USERNAME]) deleteGlobalSetting(k);
}
