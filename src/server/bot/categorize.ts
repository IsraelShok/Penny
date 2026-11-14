import "server-only";

import { getDb } from "../db/index";
import { getAllCategories } from "../db/queries/categories";
import { getUncategorizedIdsByKind, updateTransactionCategory } from "../db/queries/transactions";
import { createRule, applyRuleToPast } from "../db/queries/rules";
import { moneyFor } from "./snapshot";

/** Callback data: c:s:<offset> show, c:a:<tx>:<cat>:<offset> assign, c:m:<tx>:<offset> all categories, c:r:<tx>:<cat>:<offset> rule. */
export const CAT_PREFIX = "c:";

type Button = { text: string; callback_data: string };
export interface Card { text: string; markup: { inline_keyboard: Button[][] } }

const rows = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

interface Tx { id: number; date: string; description: string; amount: number }
const getTx = (ws: number, id: number) =>
  getDb()
    .prepare("SELECT id, date, description, ABS(charged_amount) as amount FROM transactions WHERE workspace_id = ? AND id = ?")
    .get(ws, id) as Tx | undefined;

/** Up to 5 picks: what this merchant was filed under before, then the most used categories. */
function suggestions(ws: number, description: string): { id: number; name: string }[] {
  return getDb()
    .prepare(
      `SELECT c.id, c.name FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.workspace_id = ? AND t.kind = 'expense'
         AND c.id NOT IN (SELECT parent_id FROM categories WHERE parent_id IS NOT NULL)
       GROUP BY c.id ORDER BY SUM(t.description = ?) DESC, COUNT(*) DESC LIMIT 5`
    )
    .all(ws, description) as { id: number; name: string }[];
}

/** The card for the uncategorized expense at `offset` (skipped ones push the offset forward). */
export function categorizeCard(ws: number, offset = 0, hide = false, note?: string): Card {
  const ids = getUncategorizedIdsByKind(ws, "expense");
  const head = note ? `${note}\n\n` : "";
  if (ids.length === 0) return { text: `${head}✨ הכל מסווג. אין עסקאות שמחכות.`, markup: { inline_keyboard: [] } };
  if (offset >= ids.length) offset = 0;
  const tx = getTx(ws, ids[offset])!;
  const picks = suggestions(ws, tx.description);
  const at = `${offset}`;
  return {
    text: `${head}🏷 סיווג · ${offset + 1} מתוך ${ids.length}\n\n<b>${escape(tx.description)}</b>\n${moneyFor(hide)(tx.amount)} · ${tx.date.slice(0, 10)}`,
    markup: {
      inline_keyboard: [
        ...rows(picks.map((c) => ({ text: c.name, callback_data: `${CAT_PREFIX}a:${tx.id}:${c.id}:${at}` })), 2),
        [
          { text: "עוד קטגוריות ▾", callback_data: `${CAT_PREFIX}m:${tx.id}:${at}` },
          { text: "דלג ←", callback_data: `${CAT_PREFIX}s:${offset + 1}` },
        ],
      ],
    },
  };
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Handles one tap; returns the card to show in place, or null for data it does not understand. */
export function categorizeAction(ws: number, data: string, hide = false): Card | null {
  const [kind, a, b, c] = data.slice(CAT_PREFIX.length).split(":");
  const num = (s: string | undefined) => (s != null && /^\d+$/.test(s) ? Number(s) : NaN);

  if (kind === "s") return categorizeCard(ws, num(a) || 0, hide);

  const tx = getTx(ws, num(a));
  if (!tx) return categorizeCard(ws, 0, hide, "העסקה כבר לא קיימת.");
  const categories = getAllCategories(ws, "expense", { leavesOnly: true });
  const cat = categories.find((x) => x.id === num(b));

  if (kind === "m") {
    const offset = num(b) || 0;
    const all = categories.map((x) => ({ text: x.name, callback_data: `${CAT_PREFIX}a:${tx.id}:${x.id}:${offset}` }));
    return {
      text: `🏷 בחרו קטגוריה ל<b>${escape(tx.description)}</b>`,
      markup: { inline_keyboard: [...rows(all, 3), [{ text: "→ חזרה", callback_data: `${CAT_PREFIX}s:${offset}` }]] },
    };
  }
  if (!cat) return null;
  const offset = num(c) || 0;

  if (kind === "a") {
    updateTransactionCategory(ws, tx.id, cat.id, "user");
    const card = categorizeCard(ws, offset, hide, `✓ ${escape(tx.description)} ← ${escape(cat.name)}`);
    // One tap away from never being asked about this merchant again.
    const rule = { text: `📌 תמיד ${cat.name} ל־${tx.description}`.slice(0, 60), callback_data: `${CAT_PREFIX}r:${tx.id}:${cat.id}:${offset}` };
    card.markup.inline_keyboard.unshift([rule]);
    return card;
  }
  if (kind === "r") {
    const rule = { field: "merchant" as const, op: "equals" as const, value: tx.description, categoryId: cat.id };
    createRule(ws, rule);
    const more = applyRuleToPast(ws, rule);
    return categorizeCard(ws, offset, hide, `📌 נוצר כלל: ${escape(tx.description)} ← ${escape(cat.name)}${more ? ` (סווגו עוד ${more})` : ""}`);
  }
  return null;
}
