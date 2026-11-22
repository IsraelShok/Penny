import "server-only";

import crypto from "crypto";
import { getDb } from "../db/index";
import { createCapturedCharge } from "../db/queries/manual-transactions";
import { categorizeLocally } from "../sync/categorize-local";
import { parseBankSms, type CapturedCharge } from "@/lib/quick-add";
import type { Card } from "./categorize";

/** Callback data: s:y:<key> save, s:n:<key> ignore. */
export const SMS_PREFIX = "s:";

declare global {
  var __pennySmsProposals: Map<string, CapturedCharge> | undefined;
}
// shortcut: proposals live in memory, so buttons from before a restart answer "expired"; persist them if that bites.
const proposals = () => (globalThis.__pennySmsProposals ??= new Map());

const fmt = (c: CapturedCharge) =>
  `${c.description}\n₪${c.amount.toLocaleString("he-IL", { minimumFractionDigits: 2 })} · ${c.date}${c.last4 ? ` · כרטיס ${c.last4}` : ""}`;

/** A pasted or forwarded card-charge text → a card asking to save it; null when the text is not one. */
export function smsCard(text: string, today: string): Card | null {
  const charge = parseBankSms(text, today);
  if (!charge) return null;
  const key = crypto.randomBytes(6).toString("base64url");
  const map = proposals();
  map.set(key, charge);
  if (map.size > 50) map.delete(map.keys().next().value as string);
  return {
    text: `💳 לשמור את העסקה?\n${fmt(charge)}`,
    markup: {
      inline_keyboard: [
        [
          { text: "✓ שמירה", callback_data: `${SMS_PREFIX}y:${key}` },
          { text: "✕ התעלמות", callback_data: `${SMS_PREFIX}n:${key}` },
        ],
      ],
    },
  };
}

/** Handles a save/ignore tap; returns the text to put in place of the card. */
export function smsAction(ws: number, data: string): string {
  const [, verb, key] = data.split(":");
  const charge = proposals().get(key);
  if (!charge) return "פג תוקף ההצעה. שלחו את ההודעה שוב.";
  proposals().delete(key);
  if (verb !== "y") return `לא נשמר.\n${fmt(charge)}`;
  createCapturedCharge(getDb(), ws, charge);
  categorizeLocally(ws);
  return `✓ נשמר כעסקה ממתינה. כשהעסקה תגיע מהבנק היא תחליף אותה.\n${fmt(charge)}`;
}
