import "server-only";

import { getDb } from "../index";
import { getWorkspaceSetting, setWorkspaceSetting } from "./settings";
import { defaultHomeStyle, HOME_STYLES, parsePlan, type FinancialPlan } from "@/lib/plan";
import type { Goal, InsurancePolicy } from "@/lib/types";

const PLAN_KEY = "financial_plan";

export function getPlan(workspaceId: number): FinancialPlan {
  const raw = getWorkspaceSetting(workspaceId, PLAN_KEY);
  let stored: unknown = {};
  let corrupt = false;
  try {
    stored = raw ? JSON.parse(raw) : {};
  } catch {
    corrupt = true;
  }
  const plan = parsePlan(stored);
  const has = (HOME_STYLES as readonly unknown[]).includes((stored as { homeStyle?: unknown } | null)?.homeStyle);
  if (has || corrupt) return plan; // never overwrite an unparseable blob
  // Write-once: the first read decides, so a user who later onboards or adds data keeps the style they were given.
  const hasTx = !!getDb().prepare("SELECT 1 FROM transactions WHERE workspace_id = ? LIMIT 1").get(workspaceId);
  plan.homeStyle = defaultHomeStyle(plan.profile.onboarded, hasTx);
  savePlan(workspaceId, plan);
  return plan;
}

export function savePlan(workspaceId: number, plan: FinancialPlan) {
  setWorkspaceSetting(workspaceId, PLAN_KEY, JSON.stringify(plan));
}

export function listGoals(workspaceId: number): Goal[] {
  return getDb()
    .prepare(
      `SELECT id, name, target_amount as targetAmount, target_date as targetDate, saved_amount as openingSavedAmount, saved_amount + COALESCE((SELECT SUM(l.contribution) FROM goal_links l JOIN transactions t ON t.id=l.transaction_id WHERE l.goal_id=goals.id AND t.is_excluded=0 AND t.kind='transfer' AND t.status='completed'),0) as savedAmount
       FROM goals WHERE workspace_id = ? ORDER BY target_date`
    )
    .all(workspaceId) as Goal[];
}

export function upsertGoal(workspaceId: number, g: Omit<Goal, "id"> & { id?: number }) {
  const db = getDb();
  if (g.id) {
    return db
      .prepare("UPDATE goals SET name = ?, target_amount = ?, target_date = ?, saved_amount = ? WHERE workspace_id = ? AND id = ?")
      .run(g.name, g.targetAmount, g.targetDate, g.savedAmount, workspaceId, g.id).changes > 0;
  }
  db.prepare("INSERT INTO goals (workspace_id, name, target_amount, target_date, saved_amount) VALUES (?, ?, ?, ?, ?)")
    .run(workspaceId, g.name, g.targetAmount, g.targetDate, g.savedAmount);
  return true;
}

export function listPolicies(workspaceId: number): InsurancePolicy[] {
  return getDb()
    .prepare(
      `SELECT id, name, kind, provider, monthly_premium as monthlyPremium, renewal_month as renewalMonth
       FROM insurance_policies WHERE workspace_id = ? ORDER BY renewal_month IS NULL, renewal_month, kind, name`
    )
    .all(workspaceId) as InsurancePolicy[];
}

export function upsertPolicy(workspaceId: number, p: Omit<InsurancePolicy, "id"> & { id?: number }) {
  const db = getDb();
  if (p.id) {
    return db
      .prepare("UPDATE insurance_policies SET name = ?, kind = ?, provider = ?, monthly_premium = ?, renewal_month = ? WHERE workspace_id = ? AND id = ?")
      .run(p.name, p.kind, p.provider, p.monthlyPremium, p.renewalMonth ?? null, workspaceId, p.id).changes > 0;
  }
  db.prepare("INSERT INTO insurance_policies (workspace_id, name, kind, provider, monthly_premium, renewal_month) VALUES (?, ?, ?, ?, ?, ?)")
    .run(workspaceId, p.name, p.kind, p.provider, p.monthlyPremium, p.renewalMonth ?? null);
  return true;
}

/** Table names are fixed here, never from input. */
export function deleteRow(table: "goals" | "insurance_policies", workspaceId: number, id: number): boolean {
  return getDb().prepare(`DELETE FROM ${table} WHERE workspace_id = ? AND id = ?`).run(workspaceId, id).changes > 0;
}
