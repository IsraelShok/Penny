import { describe, expect, it } from "vitest";
import { CLI_AGENTS, OPENCODE_READONLY_CONFIG } from "@/server/ai/cli-agent";

describe("OpenCode/Kilo read-only config", () => {
  const rules = [
    OPENCODE_READONLY_CONFIG.permission,
    OPENCODE_READONLY_CONFIG.agent.penny.permission,
  ];

  it("denies every tool, edits and shell included, for the default and for our agent", () => {
    for (const p of rules) {
      expect(p["*"]).toBe("deny");
      for (const tool of ["edit", "bash", "webfetch", "external_directory"] as const)
        expect(p[tool]).toBe("deny");
      expect(Object.values(p).every((v) => v === "deny")).toBe(true);
    }
  });

  it("runs the locked agent without auto-approve flags", () => {
    for (const id of ["opencode", "kilo"] as const) {
      const args: readonly string[] = CLI_AGENTS[id].args;
      expect(args).toEqual(["run", "--agent", "penny"]);
      expect(args.some((a) => /auto|yolo|skip-permissions/.test(a))).toBe(false);
    }
    expect(OPENCODE_READONLY_CONFIG.agent.penny.mode).toBe("primary");
  });
});
