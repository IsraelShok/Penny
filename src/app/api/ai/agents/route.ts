import { NextResponse } from "next/server";
import { CLI_AGENTS, isInstalled, type CliAgentId } from "@/server/ai/cli-agent";

export async function GET() {
  const ids = Object.keys(CLI_AGENTS) as CliAgentId[];
  const found = await Promise.all(ids.map(isInstalled));
  return NextResponse.json(Object.fromEntries(ids.map((id, i) => [id, found[i]])));
}
