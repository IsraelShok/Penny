import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { CLI_AGENTS, isInstalled, type CliAgentId } from "@/server/ai/cli-agent";

export const GET = handle("ai/agents", async () => {
  const ids = Object.keys(CLI_AGENTS) as CliAgentId[];
  const found = await Promise.all(ids.map(isInstalled));
  return NextResponse.json(Object.fromEntries(ids.map((id, i) => [id, found[i]])));
});
