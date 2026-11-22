// Scrubs things that must never reach a log line or a cloud AI prompt.
// Order matters: secrets that contain digits go before the generic number rules.
const KEYS = "password|pass|otp|token|apiKey|api_key|id|userCode|card6Digits|cardSuffix|num";
const RULES: [RegExp, string][] = [
  [/\bsk-[A-Za-z0-9_-]{16,}/g, "[key]"], // Anthropic / OpenAI style API keys
  [/\b\d{6,}:[A-Za-z0-9_-]{30,}/g, "[token]"], // Telegram bot tokens
  [/\b(bearer|authorization)\b\s*[:=]?\s*(?:bearer\s+)?\S+/gi, "$1 [redacted]"], // "Authorization: Bearer x" too
  [new RegExp(`"(${KEYS})"\\s*:\\s*"[^"]*"`, "gi"), '"$1":"[redacted]"'],
  [new RegExp(`\\b(${KEYS})\\s*=\\s*[^\\s&]+`, "gi"), "$1=[redacted]"],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  [/\b\d{4}(?:[ -]\d{4}){2,3}\b/g, "[number]"], // card numbers written in groups
  [/\b\d{5,}\b/g, "[number]"], // ID, account and card digits; dates and amounts stay
];

export function redact(text: string): string {
  return RULES.reduce((out, [re, rep]) => out.replace(re, rep), text);
}

/**
 * Replaces stored secrets verbatim. A bank's own error text can echo a password without
 * naming it ("login failed for 12345678/Passw0rd"), which the pattern rules cannot spot.
 */
export function redactKnownSecrets(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length < 4) continue; // too short to replace safely without mangling the text
    out = out.split(secret).join("[redacted]");
  }
  return out;
}

/** Error -> short, redacted string. Stack traces are dropped: some libraries put request bodies in them. */
export function redactError(err: unknown): string {
  return redact(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
}
