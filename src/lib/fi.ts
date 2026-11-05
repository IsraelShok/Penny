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
