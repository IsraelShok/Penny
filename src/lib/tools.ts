/** Small calculators after "המשקיע העצל" (lazyinvestor.co.il). Estimates, not advice. */
import { projectBalance } from "./plan";

export interface Fees {
  depositPct: number;
  balancePct: number;
}

/** Fund switch: end balance with current vs alternative fees (positive diff = the alternative ends higher). */
export function fundSwitch(balance: number, monthly: number, years: number, grossReturn: number, current: Fees, alt: Fees) {
  const a = projectBalance(balance, monthly, years, grossReturn, current.depositPct, current.balancePct);
  const b = projectBalance(balance, monthly, years, grossReturn, alt.depositPct, alt.balancePct);
  return { current: a, alternative: b, diff: b - a };
}

export const CAPITAL_GAINS_TAX = 0.25;

export interface GemelVsBrokerInputs {
  initial: number;
  monthly: number;
  years: number;
  grossReturn: number;
  inflation: number;
  gemelFeePct: number;
  etfFeePct: number;
  custodyMonthly: number;
}

/**
 * Investment provident fund vs a self-managed brokerage account, after tax at the end.
 * Brokerage: 25% on real gains (deposits indexed to inflation). Gemel lump sum: 25% on nominal gains.
 * Gemel as a monthly annuity after 60: tax-free, so the full balance.
 */
export function gemelVsBroker(i: GemelVsBrokerInputs) {
  const months = Math.round(i.years * 12);
  const mGemel = Math.pow(1 + i.grossReturn - i.gemelFeePct / 100, 1 / 12) - 1;
  const mEtf = Math.pow(1 + i.grossReturn - i.etfFeePct / 100, 1 / 12) - 1;
  const mInf = Math.pow(1 + i.inflation, 1 / 12) - 1;
  let gemel = i.initial;
  let broker = i.initial;
  let basis = i.initial;
  let indexedBasis = i.initial;
  for (let m = 0; m < months; m++) {
    gemel = gemel * (1 + mGemel) + i.monthly;
    broker = Math.max(0, broker * (1 + mEtf) - i.custodyMonthly) + i.monthly;
    indexedBasis = indexedBasis * (1 + mInf) + i.monthly;
    basis += i.monthly;
  }
  const brokerNet = broker - CAPITAL_GAINS_TAX * Math.max(0, broker - indexedBasis);
  const gemelLump = gemel - CAPITAL_GAINS_TAX * Math.max(0, gemel - basis);
  return { deposited: basis, broker: brokerNet, gemelLump, gemelAnnuity: gemel };
}

export interface Broker {
  perTrade: number;
  pct: number;
  custodyMonthly: number;
}

/** Value after `years` of buying `monthly` in `tradesPerMonth` trades through a broker, and the fees paid along the way. */
export function brokerOutcome(b: Broker, monthly: number, tradesPerMonth: number, years: number, grossReturn: number) {
  const r = Math.pow(1 + grossReturn, 1 / 12) - 1;
  let value = 0;
  let fees = 0;
  for (let m = 0; m < Math.round(years * 12); m++) {
    const fee = tradesPerMonth * b.perTrade + (monthly * b.pct) / 100 + b.custodyMonthly;
    fees += fee;
    value = Math.max(0, value * (1 + r) + monthly - fee);
  }
  return { value, fees };
}
