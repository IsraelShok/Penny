/** Total cost of owning a car in Israel, by powertrain. Estimates for comparison, not advice. */

export type Powertrain = "gas" | "hybrid" | "phev" | "ev";

export interface CarInputs {
  type: Powertrain;
  price: number;
  /** Share of the price paid up front, 0–1; the rest is a loan. */
  downShare: number;
  /** Annual loan rate, e.g. 0.07. */
  loanRate: number;
  loanYears: number;
  /** Litres per 100 km on fuel (for a PHEV: when the battery is empty). */
  litersPer100: number;
  /** kWh per 100 km on electricity. */
  kwhPer100: number;
  /** PHEV only: share of km driven on electricity, 0–1. */
  electricShare: number;
  insuranceYearly: number;
  maintenanceYearly: number;
  licenseYearly: number;
  /** Share of the price left after 5 years, 0–1. */
  resaleAfter5: number;
}

export interface SharedInputs {
  years: number;
  kmPerYear: number;
  fuelPrice: number;
  electricityPrice: number;
  /** Annual return the cash could earn if invested instead, e.g. 0.06. */
  investReturn: number;
}

/** Typical Israeli figures, Nov 2026. Every one is editable in the calculator. */
export const CAR_DEFAULTS: Record<
  Powertrain,
  Omit<CarInputs, "price" | "downShare" | "loanRate" | "loanYears">
> = {
  gas: {
    type: "gas",
    litersPer100: 7.5,
    kwhPer100: 0,
    electricShare: 0,
    insuranceYearly: 5_500,
    maintenanceYearly: 3_500,
    licenseYearly: 1_300,
    resaleAfter5: 0.55,
  },
  hybrid: {
    type: "hybrid",
    litersPer100: 4.8,
    kwhPer100: 0,
    electricShare: 0,
    insuranceYearly: 5_500,
    maintenanceYearly: 3_000,
    licenseYearly: 1_300,
    resaleAfter5: 0.58,
  },
  phev: {
    type: "phev",
    litersPer100: 6,
    kwhPer100: 18,
    electricShare: 0.6,
    insuranceYearly: 6_000,
    maintenanceYearly: 3_200,
    licenseYearly: 1_300,
    resaleAfter5: 0.45,
  },
  ev: {
    type: "ev",
    litersPer100: 0,
    kwhPer100: 16,
    electricShare: 1,
    insuranceYearly: 6_500,
    maintenanceYearly: 1_800,
    licenseYearly: 1_300,
    resaleAfter5: 0.45,
  },
};

export const SHARED_DEFAULTS: SharedInputs = {
  years: 5,
  kmPerYear: 15_000,
  fuelPrice: 7.2,
  electricityPrice: 0.64,
  investReturn: 0.06,
};

export interface CarCost {
  depreciation: number;
  interest: number;
  energy: number;
  insurance: number;
  maintenance: number;
  license: number;
  /** What the down payment would have earned invested over the same years. */
  missedReturn: number;
  total: number;
  perMonth: number;
  perKm: number;
  monthlyLoanPayment: number;
  resaleValue: number;
}

export function monthlyPayment(principal: number, annualRate: number, years: number): number {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return 0;
  const r = annualRate / 12;
  return r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function carCost(car: CarInputs, s: SharedInputs): CarCost {
  const resaleValue = car.price * Math.pow(car.resaleAfter5, s.years / 5);
  const depreciation = car.price - resaleValue;

  const down = car.price * car.downShare;
  const loan = car.price - down;
  const payment = monthlyPayment(loan, car.loanRate, car.loanYears);
  // Interest paid within the ownership period; a longer loan is assumed paid off on sale.
  const months = Math.min(Math.round(car.loanYears * 12), Math.round(s.years * 12));
  let balance = loan;
  let interest = 0;
  for (let m = 0; m < months; m++) {
    const i = balance * (car.loanRate / 12);
    interest += i;
    balance -= payment - i;
  }

  const km = s.kmPerYear * s.years;
  const electric = car.type === "ev" ? 1 : car.type === "phev" ? car.electricShare : 0;
  const energy =
    (km / 100) *
    ((1 - electric) * car.litersPer100 * s.fuelPrice +
      electric * car.kwhPer100 * s.electricityPrice);

  const insurance = car.insuranceYearly * s.years;
  const maintenance = car.maintenanceYearly * s.years;
  const license = car.licenseYearly * s.years;
  // Every shekel paid toward the car (down payment and each loan payment) could have been invested instead.
  const totalMonths = Math.round(s.years * 12);
  const rm = Math.pow(1 + s.investReturn, 1 / 12) - 1;
  let missedReturn = down * (Math.pow(1 + s.investReturn, s.years) - 1);
  for (let m = 1; m <= months; m++)
    missedReturn += payment * (Math.pow(1 + rm, totalMonths - m) - 1);

  const total = depreciation + interest + energy + insurance + maintenance + license + missedReturn;
  return {
    depreciation,
    interest,
    energy,
    insurance,
    maintenance,
    license,
    missedReturn,
    total,
    perMonth: total / (s.years * 12),
    perKm: km > 0 ? total / km : 0,
    monthlyLoanPayment: payment,
    resaleValue,
  };
}
