import { monthDay, type BalanceForecast } from "./balance-forecast";
export type Scenario = { expense: number; date: string; monthlySaving: number };
/** Transfers to savings reduce available cash, not net worth. Never changes the base forecast. */
export function scenarioPoints(base: BalanceForecast["points"], scenario: Scenario) {
  if (!base.length) return [];
  const expense = Number.isFinite(scenario.expense) ? Math.max(0, scenario.expense) : 0;
  const saving = Number.isFinite(scenario.monthlySaving) ? Math.max(0, scenario.monthlySaving) : 0;
  const start = base[0].date;
  const [y, m, d] = start.split("-").map(Number);
  const transfers: string[] = [];
  for (let k = 1; k <= 12; k++) transfers.push(monthDay(y, m - 1 + k, d));
  return base.map((p) => ({
    date: p.date,
    balance:
      p.balance -
      (scenario.date >= start && p.date >= scenario.date ? expense : 0) -
      transfers.filter((date) => date <= p.date).length * saving,
  }));
}
