import { NextResponse } from "next/server";
import { parsePlan } from "@/lib/plan";
import { deleteRow, getPlan, listGoals, listPolicies, savePlan, upsertGoal, upsertPolicy } from "@/server/db/queries/plan";
import { deleteManualNetWorth, saveManualNetWorth } from "@/server/db/queries/assets";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { POLICY_KINDS, type PlanPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const amount = (v: unknown) => {
  const n = Number(v);
  return v !== "" && v != null && Number.isFinite(n) && n >= 0 && n < 1e10 ? n : null;
};

export async function GET(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  const payload: PlanPayload = { plan: getPlan(ws), goals: listGoals(ws), policies: listPolicies(ws) };
  return NextResponse.json(payload);
}

/** Body: { plan } — replaces the plan settings. */
export async function PUT(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  const body = await request.json().catch(() => null);
  if (!body?.plan) return bad("plan is required");
  const plan = parsePlan(body.plan);
  savePlan(ws, plan);
  return NextResponse.json(plan);
}

/** Body: { kind: "goal" | "policy" | "netWorth", item } — creates, or updates when item.id is set. */
export async function POST(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  const body = await request.json().catch(() => null);
  const item = (body?.item ?? {}) as Record<string, unknown>;
  const id = item.id == null ? undefined : Number(item.id);
  if (id !== undefined && !Number.isInteger(id)) return bad("invalid id");

  if (body?.kind === "goal") {
    const name = text(item.name, 60);
    const targetAmount = amount(item.targetAmount);
    const targetDate = typeof item.targetDate === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(item.targetDate) ? item.targetDate : null;
    if (!name || !targetAmount || !targetDate) return bad("goal needs a name, an amount and a month (YYYY-MM)");
    const ok = upsertGoal(ws, { id, name, targetAmount, targetDate, savedAmount: amount(item.savedAmount) ?? 0 });
    return ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (body?.kind === "policy") {
    const name = text(item.name, 60);
    const kind = POLICY_KINDS.find((k) => k === item.kind);
    const monthlyPremium = amount(item.monthlyPremium);
    if (!name || !kind || monthlyPremium == null) return bad("policy needs a name, a kind and a monthly premium");
    const rm = item.renewalMonth;
    if (rm != null && rm !== "" && !(typeof rm === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(rm))) return bad("renewal month must be YYYY-MM");
    const renewalMonth = typeof rm === "string" && rm ? rm : null;
    const ok = upsertPolicy(ws, { id, name, kind, provider: text(item.provider, 60), monthlyPremium, renewalMonth });
    return ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (body?.kind === "netWorth") {
    const date = typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : null;
    const netWorth = Number(item.netWorth);
    if (!date || !Number.isFinite(netWorth) || Math.abs(netWorth) >= 1e10) return bad("net worth needs a date and an amount");
    saveManualNetWorth(ws, date, netWorth);
    return NextResponse.json({ success: true });
  }
  return bad("unknown kind");
}

/** ?kind=goal|policy&id=… or ?kind=netWorth&date=YYYY-MM-DD */
export async function DELETE(request: Request) {
  const ws = getWorkspaceIdFromRequest(request);
  const q = new URL(request.url).searchParams;
  const kind = q.get("kind");
  let ok = false;
  if (kind === "goal" || kind === "policy") {
    const id = Number(q.get("id"));
    if (!Number.isInteger(id)) return bad("invalid id");
    ok = deleteRow(kind === "goal" ? "goals" : "insurance_policies", ws, id);
  } else if (kind === "netWorth") {
    ok = deleteManualNetWorth(ws, q.get("date") ?? "");
  } else return bad("unknown kind");
  return ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: "not found" }, { status: 404 });
}
