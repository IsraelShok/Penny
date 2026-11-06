import { NextResponse } from "next/server";
import { addSettleEntry, deleteSettleEntry, getSettleRows, listSettleEntries } from "@/server/db/queries/transactions";
import { getAppSettings, getWorkspaceSetting, setWorkspaceSetting } from "@/server/db/queries/settings";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { isValidOwner, type AccountOwners } from "@/lib/tags";
import { DEFAULT_RULE, ledger, parseSplitRule, parseSplitRules } from "@/lib/settle";

const RULES_KEY = "split_rules";
const COUNTERPART_ROLES = ["partner", "roommate", "exPartner", "sibling", "parent"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readJSON(workspaceId: number, key: string): unknown {
  try { return JSON.parse(getWorkspaceSetting(workspaceId, key) ?? "{}"); } catch { return {}; }
}

function context(workspaceId: number) {
  const members = getAppSettings(workspaceId).household.members;
  const ids = members.map((m) => m.id);
  const accountOwners = Object.fromEntries(
    Object.entries(readJSON(workspaceId, "account_owners") as Record<string, unknown>).filter(([, v]) => isValidOwner(v, ids)),
  ) as AccountOwners;
  return {
    me: members.find((m) => m.role === "me") ?? null,
    counterparts: members.filter((m) => COUNTERPART_ROLES.includes(m.role)),
    accountOwners,
    rules: parseSplitRules(readJSON(workspaceId, RULES_KEY), ids),
  };
}

/** Ledger per counterpart since each one's last settle-up. */
export async function GET(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const { me, counterparts, accountOwners, rules } = context(workspaceId);
  if (!me) return NextResponse.json({ me: null, counterparts: [] });
  const entries = listSettleEntries(workspaceId);
  const today = new Date().toISOString().slice(0, 10);
  const rows = counterparts.length ? getSettleRows(workspaceId, "0000") : [];
  return NextResponse.json({
    me: me.id,
    counterparts: counterparts.map((member) => {
      const rule = rules[member.id] ?? DEFAULT_RULE;
      const l = ledger(rows, accountOwners, me.id, member.id, rule, entries, today);
      return { member, rule, balance: l.balance, since: l.since, lines: l.lines.slice(0, 30), entries: entries.filter((e) => e.counterpart === member.id) };
    }),
  });
}

/** Sets one counterpart's split rule: { counterpart, rule }. */
export async function PUT(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const body = (await request.json().catch(() => ({}))) as { counterpart?: unknown; rule?: unknown };
  const { counterparts, rules } = context(workspaceId);
  if (!counterparts.some((m) => m.id === body.counterpart)) return NextResponse.json({ error: "unknown counterpart" }, { status: 400 });
  try {
    const next = { ...rules, [body.counterpart as string]: parseSplitRule(body.rule) };
    setWorkspaceSetting(workspaceId, RULES_KEY, JSON.stringify(next));
    return NextResponse.json({ rules: next });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** Records a settle-up: { counterpart, date, amount }. */
export async function POST(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const body = (await request.json().catch(() => ({}))) as { counterpart?: unknown; date?: unknown; amount?: unknown };
  const { counterparts } = context(workspaceId);
  if (!counterparts.some((m) => m.id === body.counterpart)) return NextResponse.json({ error: "unknown counterpart" }, { status: 400 });
  if (typeof body.date !== "string" || !DATE_RE.test(body.date)) return NextResponse.json({ error: "invalid date" }, { status: 400 });
  if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || Math.abs(body.amount) > 1e9) return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  const id = addSettleEntry(workspaceId, body.counterpart as string, body.date, body.amount);
  return NextResponse.json({ id });
}

/** Undo a settle-up: ?id= */
export async function DELETE(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || !deleteSettleEntry(workspaceId, id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
