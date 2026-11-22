import { goalMonthly, goalReachMonth } from "./plan";

/** Whole months from `from` to `to` (both YYYY-MM); negative when `to` is earlier. */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export interface FitGoal {
  id: number;
  targetAmount: number;
  savedAmount: number;
  /** YYYY-MM */
  targetDate: string;
  /** false when the date was derived, not chosen: such a goal has no date to slip from. */
  dated?: boolean;
}

export interface GoalFit {
  id: number;
  /** Monthly saving the date needs. */
  need: number;
  /** Monthly saving left for this goal once earlier-dated goals took their share. */
  allocated: number;
  /** Month reached at the allocated pace; null when nothing is left for it. */
  reach: string | null;
  /** Months late against the target date (0 = on time); null when it is never reached at this pace. */
  slipMonths: number | null;
}

/**
 * Do the dated goals fit what the household actually saves a month? Saving goes to the goals in
 * date order, each taking what its date needs; the goals the money runs out on show how late they land.
 * shortcut: the split is fixed for the whole horizon (money freed when an early goal finishes is not
 * re-spread), so slips are an upper bound; upgrade to a month-by-month simulation if that matters.
 */
export function goalsFit(goals: FitGoal[], monthlySaving: number, today: Date): GoalFit[] {
  let left = Math.max(0, monthlySaving);
  return goals
    .filter((g) => g.dated !== false && g.savedAmount < g.targetAmount)
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate) || a.id - b.id)
    .map((g) => {
      const need = goalMonthly(g.targetAmount, g.savedAmount, g.targetDate, today);
      const allocated = Math.min(need, left);
      left -= allocated;
      const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      // Fully funded and still ahead = on time (skips float noise in gap / need); otherwise project.
      const reach =
        allocated >= need && g.targetDate > current
          ? g.targetDate
          : goalReachMonth(g.targetAmount, g.savedAmount, allocated, today);
      const slipMonths = reach === null ? null : Math.max(0, monthsBetween(g.targetDate, reach));
      return { id: g.id, need, allocated, reach, slipMonths };
    });
}
