/** Financial independence math, after HaExolidit's "עד מתי?!", "חיסכון אגרסיבי" and "הרכב כמגרסה" sheets. */

/** Money needed so that withdrawing `rate` a year covers `annualSpend` (4% -> 25x, 3% -> 33x). */
export function fiNumber(annualSpend: number, withdrawalRate: number): number {
  return withdrawalRate > 0 ? annualSpend / withdrawalRate : Infinity;
}

const MAX_YEARS = 100;

/**
 * Years until savings reach `target`, saving `monthlySaving` a month at `annualReturn`, compounded monthly.
 * 0 if already there; null if it never gets there within 100 years.
 */
export function yearsToTarget(current: number, monthlySaving: number, annualReturn: number, target: number): number | null {
  if (current >= target) return 0;
  const r = Math.pow(1 + annualReturn, 1 / 12) - 1;
  let balance = current;
  for (let month = 1; month <= MAX_YEARS * 12; month++) {
    balance = balance * (1 + r) + monthlySaving;
    if (balance >= target) return month / 12;
  }
  return null;
}

export interface CarInputs {
  purchasePrice: number;
  currentValue: number;
  kmDriven: number;
  kmPerYear: number;
  kmPerLiter: number;
  fuelPrice: number;
  annualTest: number;
  annualInsurance: number;
  annualMaintenance: number;
}

/** Yearly cost of owning the car (depreciation spread over the years owned, plus running costs) and cost per km. */
export function carCost(c: CarInputs): { years: number; perYear: number; perKm: number } | null {
  if (c.kmPerYear <= 0 || c.kmPerLiter <= 0) return null;
  const years = c.kmDriven / c.kmPerYear;
  const depreciation = years > 0 ? (c.purchasePrice - c.currentValue) / years : 0;
  const fuel = (c.kmPerYear / c.kmPerLiter) * c.fuelPrice;
  const perYear = depreciation + fuel + c.annualTest + c.annualInsurance + c.annualMaintenance;
  return { years, perYear, perKm: perYear / c.kmPerYear };
}

export interface FiEvent {
  year: number;
  /** One-off, negative = cost. */
  amount: number;
  /** Extra monthly spending from that year on (negative = spend less). */
  monthlyChange: number;
}

/**
 * Like yearsToTarget, with life events and an optional return per year (for Monte Carlo).
 * shortcut: monthlyChange moves the saving only, not the FI number; upgrade if events should change the target too.
 */
export function yearsToTargetWithEvents(
  current: number, monthlySaving: number, annualReturn: number | number[], target: number, events: FiEvent[], startYear: number, maxYears = MAX_YEARS
): number | null {
  let balance = current;
  for (let y = 0; y < maxYears; y++) {
    const year = startYear + y;
    const ret = typeof annualReturn === "number" ? annualReturn : annualReturn[y];
    const r = Math.pow(1 + Math.max(-0.99, ret), 1 / 12) - 1;
    let saving = monthlySaving;
    for (const e of events) {
      if (e.year === year) balance += e.amount;
      if (e.year <= year) saving -= e.monthlyChange;
    }
    if (y === 0 && balance >= target) return 0;
    for (let m = 1; m <= 12; m++) {
      balance = balance * (1 + r) + saving;
      if (balance >= target) return y + m / 12;
    }
  }
  return null;
}

/** Small seeded PRNG (mulberry32) so the odds don't jump between renders. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Monte Carlo: yearly returns ~ normal(mean, sd). Chance to reach the target within `years`,
 * and the 10th/50th/90th percentile year (null = not within 100 years).
 */
export function fiOdds(
  current: number, monthlySaving: number, meanReturn: number, target: number, years: number,
  events: FiEvent[] = [], startYear = new Date().getFullYear(), runs = 1000, sd = 0.15, seed = 42
): { probability: number; p10: number | null; p50: number | null; p90: number | null } {
  const rand = mulberry32(seed);
  const results: number[] = [];
  for (let i = 0; i < runs; i++) {
    const returns = Array.from({ length: MAX_YEARS }, () => {
      const u = 1 - rand();
      return meanReturn + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
    });
    results.push(yearsToTargetWithEvents(current, monthlySaving, returns, target, events, startYear) ?? Infinity);
  }
  results.sort((a, b) => a - b);
  const at = (q: number) => {
    const v = results[Math.min(runs - 1, Math.floor(q * runs))];
    return Number.isFinite(v) ? v : null;
  };
  return { probability: results.filter((y) => y <= years).length / runs, p10: at(0.1), p50: at(0.5), p90: at(0.9) };
}