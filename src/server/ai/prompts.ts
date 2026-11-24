import "server-only";

import type {
  CategoryForCategorization,
  PastCorrection,
  TransactionForCategorization,
} from "./types";
import { redact } from "../lib/redact";
import { normalizeMerchant } from "../rules/normalize";

function renderCategoryLine(c: CategoryForCategorization, indent = ""): string {
  return c.description && c.description.trim().length > 0
    ? `${indent}- ${c.name} - ${c.description.trim()}`
    : `${indent}- ${c.name}`;
}

function renderCategories(categories: CategoryForCategorization[]): string {
  const ungrouped: CategoryForCategorization[] = [];
  const groups = new Map<string, CategoryForCategorization[]>();
  for (const c of categories) {
    const parent = c.parentName?.trim();
    if (parent && parent.length > 0) {
      const list = groups.get(parent) ?? [];
      list.push(c);
      groups.set(parent, list);
    } else {
      ungrouped.push(c);
    }
  }

  if (groups.size === 0) {
    return ungrouped.map((c) => renderCategoryLine(c)).join("\n");
  }

  const sections: string[] = [];
  for (const [parent, kids] of groups) {
    const lines = kids.map((c) => renderCategoryLine(c, "  ")).join("\n");
    sections.push(`${parent}:\n${lines}`);
  }
  if (ungrouped.length > 0) {
    const lines = ungrouped.map((c) => renderCategoryLine(c, "  ")).join("\n");
    sections.push(`Ungrouped:\n${lines}`);
  }
  return sections.join("\n");
}

const HIERARCHY_RULE =
  "Category lists may show group headers (e.g., 'Food:') with leaves indented beneath them. Group headers are NOT valid categoryName values - always pick a leaf (the indented name).";

function renderCorrections(corrections: PastCorrection[], local: boolean): string {
  if (corrections.length === 0) return "";
  const lines = corrections
    .map(
      (c) =>
        `- "${forModel(c.description, local)}" → wrong: ${c.wrongCategory}, correct: ${c.correctCategory}`,
    )
    .join("\n");
  return `
Past corrections (the AI miscategorized these before — apply the lesson to similar merchants):
${lines}
`;
}

const CONFIDENCE_BLOCK = `Confidence scale (integer 1-7):
- 7: certain. Well-known merchant, clearly fits this category.
- 5-6: confident. Reasonable inference, minor ambiguity.
- 4: moderate. The category fits but other categories are plausible.
- 1-3: uncertain. Description is generic, merchant is unknown, or several categories could fit. Be honest — when in doubt give 1-3.`;

// A transfer's description is usually a person's name ("העברה לדנה כהן"). The kind of transfer is enough to categorize.
const TRANSFER = /העברה|העברת|הוראת קבע|הו"ק|ביט|\bbit\b|paybox|פייבוקס|pepper ?pay|\btransfer\b/i;

/** For a cloud model: a transfer keeps only its kind ("העברה"), never the name of the person on the other side. */
export function hideTransferNames(description: string): string {
  const m = description.match(TRANSFER);
  return m ? `${m[0]} [name hidden]` : description;
}

/** A description as a model may see it: account, ID and card digits never; transfer names only on this machine. */
const forModel = (description: string, local: boolean) =>
  local ? redact(description) : hideTransferNames(redact(description));

/**
 * The biggest merchants with their totals, for the free-form "ask" prompt. Names are redacted and
 * transfers are left out: their "merchant" is a person.
 */
export function topMerchantsForAI(
  rows: { description: string; amount: number }[],
  limit = 20,
): { merchant: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (TRANSFER.test(r.description)) continue;
    const m = redact(normalizeMerchant(r.description));
    totals.set(m, (totals.get(m) ?? 0) - r.amount);
  }
  return [...totals]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([merchant, total]) => ({ merchant, total: Math.round(total) }));
}

export function buildCategorizationPrompt(
  transactions: TransactionForCategorization[],
  categories: CategoryForCategorization[],
  allowProposals = false,
  pastCorrections: PastCorrection[] = [],
  /** A model on this machine (Ollama) may see transfer names; a cloud one may not. */
  local = false,
): string {
  const categoriesBlock = renderCategories(categories);
  const correctionsBlock = renderCorrections(pastCorrections, local);

  const transactionLines = transactions
    .map(
      (t, i) =>
        // Account, ID and card digits never help categorize and must not reach a cloud model.
        // A transfer's memo is usually a note to or about the other person, so a cloud model never sees it.
        `${i}: "${forModel(t.description, local)}" | ${t.currency} ${Math.abs(t.amount).toFixed(2)}${t.memo && (local || !TRANSFER.test(t.description)) ? ` | memo: "${redact(t.memo)}"` : ""}`,
    )
    .join("\n");

  if (!allowProposals) {
    return `Categorize these financial transactions.

Categories (use ONLY these names):
${categoriesBlock}
${correctionsBlock}
Transactions:
${transactionLines}

Return ONLY a valid JSON array. Each element MUST have "index" (number), "categoryName" (string from the list above), and "confidence" (integer 1-7).
Example: [{"index": 0, "categoryName": "Groceries", "confidence": 7}, {"index": 1, "categoryName": "Transport", "confidence": 5}]

${CONFIDENCE_BLOCK}

Rules:
- Use ONLY category names from the provided list.
- ${HIERARCHY_RULE}
- Every transaction must be categorized; pick the closest matching category.
- Israeli merchant names (Hebrew or transliterated) are common; categorize based on the business type.
- Pay attention to the "NOT" clauses in the category descriptions - they disambiguate common confusions.
- Apply lessons from "Past corrections" - if a new merchant resembles a past correction, prefer the corrected category.`;
  }

  // Proposal mode: the AI is encouraged to suggest new categories whenever
  // a transaction doesn't have a clear fit in the existing list.
  return `Categorize these financial transactions. Use an existing category when one clearly fits. When no existing category is a good fit, propose a new one.

Existing categories:
${categoriesBlock}
${correctionsBlock}
Transactions:
${transactionLines}

Return ONLY a valid JSON array. Each element MUST have "index" (number), "categoryName" (string), and "confidence" (integer 1-7). If you propose a new category, add "isNew": true.

Existing category example: {"index": 0, "categoryName": "Groceries", "confidence": 7}
New category example:      {"index": 3, "categoryName": "Pet Supplies", "isNew": true, "confidence": 5}

${CONFIDENCE_BLOCK}

Rules for new categories:
- General English names that describe a TYPE of spending, not a specific merchant. Good: "Pet Supplies", "Childcare", "Tools & Hardware", "Books & Media". Bad: "Petco", "My favorite cafe".
- Title Case, 1-3 words, ASCII letters and spaces only.
- If several transactions need the same new category, reuse the same name with isNew: true on each.
- Don't over-propose. If an existing category is a reasonable fit, prefer it.

Rules for every transaction:
- Every transaction must be categorized - either an existing or a proposed new category.
- ${HIERARCHY_RULE}
- Israeli merchant names (Hebrew or transliterated) are common; categorize based on the business type.
- Pay attention to the "NOT" clauses in the category descriptions.
- Apply lessons from "Past corrections" - if a new merchant resembles a past correction, prefer the corrected category.`;
}

export const SYSTEM_PROMPT =
  "You are a financial transaction categorizer. You receive transaction descriptions and return JSON categorizations. Be precise and consistent. Respond with ONLY the JSON array, no other text.";
