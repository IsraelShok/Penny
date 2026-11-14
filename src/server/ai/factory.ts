import "server-only";

import type { AIProvider } from "./types";
import { ClaudeProvider } from "./providers/claude";
import { OllamaProvider } from "./providers/ollama";
import { CliAgentProvider } from "./providers/cli-agent";
import { isCliAgent } from "./cli-agent";
import { getSetting } from "../db/queries/settings";
import { decrypt, isKeyLocked } from "../lib/encryption";

export function createAIProvider(): AIProvider | null {
  const provider = getSetting("ai_provider");

  if (provider === "claude") {
    const encryptedKey = getSetting("ai_api_key_encrypted");
    const iv = getSetting("ai_api_key_iv");
    const authTag = getSetting("ai_api_key_auth_tag");

    if (!encryptedKey || !iv || !authTag || isKeyLocked()) return null;

    const apiKey = decrypt({
      encrypted: Buffer.from(encryptedKey, "hex"),
      iv: Buffer.from(iv, "hex"),
      authTag: Buffer.from(authTag, "hex"),
    });

    return new ClaudeProvider(apiKey);
  }

  if (provider === "ollama") {
    const url = getSetting("ai_ollama_url") ?? "http://localhost:11434";
    const model = getSetting("ai_ollama_model") ?? "llama3.1";
    return new OllamaProvider(url, model);
  }

  if (isCliAgent(provider)) return new CliAgentProvider(provider);

  return null;
}
