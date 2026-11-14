import "server-only";

import type {
  AIProvider,
  CategoryForCategorization,
  CategoryMapping,
  PastCorrection,
  TransactionForCategorization,
} from "../types";
import { buildCategorizationPrompt, SYSTEM_PROMPT } from "../prompts";
import { runCliAgent, type CliAgentId } from "../cli-agent";
import { parseResponse } from "./ollama";

export class CliAgentProvider implements AIProvider {
  constructor(private agent: CliAgentId) {}

  async categorize(
    transactions: TransactionForCategorization[],
    categories: CategoryForCategorization[],
    options?: { allowProposals?: boolean; pastCorrections?: PastCorrection[] }
  ): Promise<CategoryMapping[]> {
    const allowProposals = options?.allowProposals ?? false;
    const prompt = buildCategorizationPrompt(transactions, categories, allowProposals, options?.pastCorrections ?? []);
    const text = await runCliAgent(this.agent, `${SYSTEM_PROMPT}\n\nDo not use any tools or read files. Reply with the JSON only.\n\n${prompt}`);
    return parseResponse(text, categories.map((c) => c.name), allowProposals);
  }
}
