import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "../db/queries/settings";
import { decrypt } from "../lib/encryption";
import { normalizeOllamaUrl } from "@/lib/url-guard";

const SYSTEM = `You answer questions about a person's own household money, using ONLY the aggregated JSON data given.
Answer in the same language as the question (Hebrew or English), in at most two short, calm sentences, numbers in ₪.
If the data cannot answer the question, say so plainly. Never give investment advice.`;

/**
 * Free-form answer from the user's chosen provider. `context` must be aggregated numbers only
 * (category/month totals, merchant names with totals) — never raw transactions.
 * Returns null when no provider is configured.
 */
export async function askAI(question: string, context: unknown): Promise<string | null> {
  const provider = getSetting("ai_provider");
  const user = `Data:\n${JSON.stringify(context)}\n\nQuestion: ${question}`;

  if (provider === "ollama") {
    const base = normalizeOllamaUrl(getSetting("ai_ollama_url") ?? "http://localhost:11434");
    if (!base) return null;
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: getSetting("ai_ollama_model") ?? "llama3.1", stream: false, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }] }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Ollama request failed: ${res.status}`);
    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content?.trim() || null;
  }

  if (provider === "claude") {
    const encrypted = getSetting("ai_api_key_encrypted");
    const iv = getSetting("ai_api_key_iv");
    const authTag = getSetting("ai_api_key_auth_tag");
    if (!encrypted || !iv || !authTag) return null;
    const apiKey = decrypt({ encrypted: Buffer.from(encrypted, "hex"), iv: Buffer.from(iv, "hex"), authTag: Buffer.from(authTag, "hex") });
    const res = await new Anthropic({ apiKey }).messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const block = res.content[0];
    return block?.type === "text" ? block.text.trim() || null : null;
  }

  return null;
}
