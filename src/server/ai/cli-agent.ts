import "server-only";

import { spawn, execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Local coding-agent CLIs used as plain prompt→text completers. They still send the prompt to the vendor's cloud. */
export const CLI_AGENTS = {
  // Read-only sandbox, no approvals, no session files. Prompt from stdin ("-").
  // https://developers.openai.com/codex/noninteractive
  codex: {
    bin: "codex",
    args: ["exec", "--skip-git-repo-check", "--ephemeral", "--sandbox", "read-only", "-"],
  },
  // Non-TTY stdin triggers headless mode; default approval mode cannot run edit/shell tools without a human.
  // https://geminicli.com/docs/cli/headless/
  gemini: { bin: "gemini", args: ["--output-format", "json"] },
  // `run` reads the prompt from piped stdin and auto-rejects any "ask"; OPENCODE_CONFIG below denies every tool.
  // https://opencode.ai/docs/permissions/  https://opencode.ai/docs/cli/
  opencode: { bin: "opencode", args: ["run", "--agent", "penny"] },
  // Kilo CLI is an OpenCode fork with the same config and permissions; it also reads opencode.json.
  // https://kilo.ai/docs/cli
  kilo: { bin: "kilo", args: ["run", "--agent", "penny"] },
} as const;

const DENY_ALL = {
  "*": "deny",
  read: "deny",
  edit: "deny",
  bash: "deny",
  webfetch: "deny",
  websearch: "deny",
  task: "deny",
  external_directory: "deny",
} as const;

/** OpenCode/Kilo config written into the empty cwd and passed inline: no tool may run, for the session default and our own agent. */
export const OPENCODE_READONLY_CONFIG = {
  $schema: "https://opencode.ai/config.json",
  permission: DENY_ALL,
  agent: {
    penny: { mode: "primary", description: "Penny text-only completer", permission: DENY_ALL },
  },
};

const usesOpenCodeConfig = (id: CliAgentId) => id === "opencode" || id === "kilo";

export type CliAgentId = keyof typeof CLI_AGENTS;
export const isCliAgent = (p: string | null | undefined): p is CliAgentId => !!p && p in CLI_AGENTS;

/** Is the agent's binary on PATH? */
export function isInstalled(id: CliAgentId): Promise<boolean> {
  const finder = process.platform === "win32" ? "where" : "which";
  return new Promise((resolve) => execFile(finder, [CLI_AGENTS[id].bin], (err) => resolve(!err)));
}

/** Run the agent once. The prompt goes over stdin only, never into argv or a shell string. */
export function runCliAgent(id: CliAgentId, prompt: string, timeoutMs = 120_000): Promise<string> {
  const { bin, args } = CLI_AGENTS[id];
  // Empty working dir so the agent sees no project files.
  const cwd = mkdtempSync(join(tmpdir(), "penny-agent-"));
  // OpenCode/Kilo resolve their project dir from $PWD first, which may still point at this app's folder.
  const env: NodeJS.ProcessEnv = { ...process.env, PWD: cwd };
  if (usesOpenCodeConfig(id)) {
    const json = JSON.stringify(OPENCODE_READONLY_CONFIG);
    writeFileSync(join(cwd, "opencode.json"), json);
    env.OPENCODE_CONFIG_CONTENT = json;
    env.KILO_CONFIG_CONTENT = json;
  }
  return new Promise<string>((resolve, reject) => {
    // npm installs .cmd shims on Windows, which need a shell; argv is constants only, so this is safe.
    const child = spawn(bin, [...args], {
      cwd,
      env,
      shell: process.platform === "win32",
      windowsHide: true,
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${bin} timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`${bin} could not start (is it installed?): ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0)
        return reject(
          new Error(
            `${bin} exited ${code}: ${err.trim().slice(-300) || "no output"} — run "${bin}" once in a terminal to sign in`,
          ),
        );
      // Our locked agent wasn't loaded, so the CLI ran with its own defaults: don't trust that run.
      if (usesOpenCodeConfig(id) && /falling back to default agent/i.test(err))
        return reject(new Error(`${bin} ignored Penny's read-only config`));
      resolve(id === "gemini" ? parseGemini(out) : out.trim());
    });
    child.stdin.end(prompt);
  }).finally(() => rmSync(cwd, { recursive: true, force: true }));
}

function parseGemini(out: string): string {
  const data = JSON.parse(out.slice(out.indexOf("{"))) as {
    response?: string;
    error?: { message?: string };
  };
  if (data.error) throw new Error(`gemini: ${data.error.message ?? "request failed"}`);
  return (data.response ?? "").trim();
}
