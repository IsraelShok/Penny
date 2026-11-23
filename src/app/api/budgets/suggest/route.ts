import { handle } from "@/server/lib/api-error";
import { NextResponse } from "next/server";
import { getAllBudgets } from "@/server/db/queries/budgets";
import { getAllCategories } from "@/server/db/queries/categories";
import { getCategorySpendInRange } from "@/server/db/queries/transactions";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";
import { toLocalISODate, israelNoon } from "@/server/lib/date-utils";
import { suggestBudgets } from "@/lib/budget-suggest";

export const GET = handle("budgets/suggest", async (request: Request) => {
  const workspaceId = getWorkspaceIdFromRequest(request);
  const now = israelNoon();
  // Last 3 complete months; a month with no expenses at all (before the first sync) is left out of the average.
  const months = [1, 2, 3]
    .map((i) =>
      getCategorySpendInRange(
        workspaceId,
        toLocalISODate(new Date(now.getFullYear(), now.getMonth() - i, 1)),
        toLocalISODate(new Date(now.getFullYear(), now.getMonth() - i + 1, 0)),
      ),
    )
    .filter((rows) => rows.length > 0)
    .map((rows) => new Map(rows.map((r) => [r.categoryId, r.amount])));

  const categories = getAllCategories(workspaceId, "expense");
  const parents = new Set(categories.map((c) => c.parentId).filter((id) => id != null));
  const budgets = new Map(getAllBudgets(workspaceId).map((b) => [b.categoryId, b.monthlyAmount]));

  return NextResponse.json(
    suggestBudgets(
      categories
        .filter((c) => !parents.has(c.id)) // budgets live on leaves; parents roll up
        .map((c) => ({
          categoryId: c.id,
          name: c.name,
          monthly: months.map((m) => m.get(c.id) ?? 0),
          currentBudget: budgets.get(c.id) ?? null,
        })),
    ),
  );
});
