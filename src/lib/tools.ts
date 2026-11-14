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
  const months = Math.min(1200, Math.round(i.years * 12)); // 100-year cap: huge typed years would freeze the page
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
  for (let m = 0; m < Math.min(1200, Math.round(years * 12)); m++) { // 100-year cap, as above
    const fee = tradesPerMonth * b.perTrade + (monthly * b.pct) / 100 + b.custodyMonthly;
    fees += fee;
    value = Math.max(0, value * (1 + r) + monthly - fee);
  }
  return { value, fees };
}

/** Progressive tax from [upTo, rate] brackets. */
export function bracketTax(amount: number, brackets: readonly (readonly [number, number])[]) {
  let tax = 0, from = 0;
  for (const [upTo, rate] of brackets) {
    if (amount <= from) break;
    tax += (Math.min(amount, upTo) - from) * rate;
    from = upTo;
  }
  return tax;
}

/** Monthly Spitzer (annuity) payment. */
export function spitzer(principal: number, annualRate: number, years: number) {
  const n = Math.max(1, Math.round(years * 12)), r = annualRate / 12;
  return principal <= 0 ? 0 : r === 0 ? principal / n : (principal * r) / (1 - (1 + r) ** -n);
}

export interface RentBuyInputs {
  price: number;
  down: number;
  mortgageRate: number;
  mortgageYears: number;
  purchaseTax: number;
  /** Lawyer, broker, renovation. */
  oneOffs: number;
  /** Owner-only monthly costs (maintenance, insurance, building fee). Arnona is paid by both, so leave it out or put the difference. */
  ownerMonthly: number;
  appreciation: number;
  rent: number;
  rentGrowth: number;
  investReturn: number;
  years: number;
}

/**
 * Rent vs buy, month by month. Whoever pays less each month invests the difference; the renter also
 * invests what the buyer paid upfront. Owner costs grow with rent. Ignores selling costs and taxes on gains.
 */
export function rentVsBuy(i: RentBuyInputs) {
  const loan = Math.max(0, i.price - i.down);
  const payment = spitzer(loan, i.mortgageRate, i.mortgageYears);
  const mr = i.mortgageRate / 12, ir = (1 + i.investReturn) ** (1 / 12) - 1;
  let balance = loan, home = i.price, buyPf = 0, rentPf = i.down + i.purchaseTax + i.oneOffs;
  let rent = i.rent, owner = i.ownerMonthly;
  const yearly: { year: number; buy: number; rent: number }[] = [];
  let breakEven: number | null = null;
  const firstMonth = { buy: payment + owner, rent };
  for (let m = 1; m <= i.years * 12; m++) {
    const pay = balance > 0.01 ? Math.min(payment, balance * (1 + mr)) : 0;
    balance = Math.max(0, balance * (1 + mr) - pay);
    const buyCost = pay + owner;
    buyPf = buyPf * (1 + ir) + Math.max(0, rent - buyCost);
    rentPf = rentPf * (1 + ir) + Math.max(0, buyCost - rent);
    home *= (1 + i.appreciation) ** (1 / 12);
    if (m % 12 === 0) {
      const y = { year: m / 12, buy: home - balance + buyPf, rent: rentPf };
      yearly.push(y);
      if (breakEven == null && y.buy >= y.rent) breakEven = y.year;
      rent *= 1 + i.rentGrowth;
      owner *= 1 + i.rentGrowth;
    }
  }
  const last = yearly.at(-1) ?? { year: 0, buy: i.price - loan, rent: rentPf };
  return { payment, firstMonth, yearly, breakEven, buy: last.buy, rent: last.rent, diff: last.buy - last.rent };
}

export interface Amendment190Inputs {
  balance: number;
  /** Share of the balance that is real (inflation-adjusted) gain, 0–1. */
  realGainShare: number;
  age: number;
  /** Monthly qualifying pension (not Bituach Leumi). */
  qualifyingPension: number;
  /** Annuity factor: balance ÷ factor = monthly annuity. */
  annuityFactor: number;
  minAge: number;
  minQualifyingPension: number;
  lumpRealGainTax: number;
}

/** Amendment 190: tax-free monthly annuity vs lump sum taxed on the real gain. */
export function amendment190(i: Amendment190Inputs) {
  const monthly = i.annuityFactor > 0 ? i.balance / i.annuityFactor : 0;
  const taxSaved = Math.max(0, i.balance * Math.min(1, Math.max(0, i.realGainShare)) * i.lumpRealGainTax);
  const ageOk = i.age >= i.minAge;
  const pensionOk = i.qualifyingPension >= i.minQualifyingPension;
  return { monthly, taxSaved, lumpNet: i.balance - taxSaved, ageOk, pensionOk, eligible: ageOk && pensionOk };
}

/**
 * A lump sum: prepay a loan or invest it, after `years`. Prepaying saves compound interest, tax-free;
 * investing earns the return, less 25% tax on nominal gains. Ignores prepayment fees (עמלת פירעון מוקדם).
 */
export function payoffVsInvest(lump: number, loanRate: number, investReturn: number, years: number) {
  const saved = lump * ((1 + loanRate) ** years - 1);
  const earned = lump * ((1 + investReturn) ** years - 1) * (1 - CAPITAL_GAINS_TAX);
  return { saved, earned, diff: earned - saved };
}

/** Rental property yields: gross, net of costs, and the cash return on your own money after the mortgage. */
export function rentalYield(i: { price: number; equity: number; rent: number; costs: number; rate: number; years: number }) {
  const payment = spitzer(Math.max(0, i.price - i.equity), i.rate, i.years);
  const cashflow = i.rent - i.costs - payment;
  return {
    gross: i.price > 0 ? (i.rent * 12) / i.price : 0,
    net: i.price > 0 ? ((i.rent - i.costs) * 12) / i.price : 0,
    cashOnCash: i.equity > 0 ? (cashflow * 12) / i.equity : 0,
    payment,
    cashflow,
  };
}

/** Money left in checking vs a money-market fund: fund value after fee and 25% tax on real gains. */
export function moneyMarket(amount: number, years: number, yieldPct: number, feePct: number, inflation: number) {
  const gross = amount * (1 + (yieldPct - feePct) / 100) ** years;
  const realBasis = amount * (1 + inflation / 100) ** years;
  const net = gross - CAPITAL_GAINS_TAX * Math.max(0, gross - realBasis);
  return { net, gain: net - amount };
}
