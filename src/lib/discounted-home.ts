/**
 * "דירה בהנחה" (formerly מחיר למשתכן) vs buying on the open market now.
 * Estimates for comparison, not advice. Program terms change between lotteries; every figure is editable.
 */
import { IL } from "./il-defaults";
import { bracketTax, spitzer } from "./tools";

export interface DiscountedHomeInputs {
  /** Market price of a comparable apartment today. */
  marketPrice: number;
  /** Program discount off the market price, 0–1. */
  discountPct: number;
  /** Largest discount in ₪. */
  discountCap: number;
  /** Years from winning until you get the keys. */
  yearsToKeys: number;
  /** Share of the price paid at the keys and linked to the construction index meanwhile, 0–1. */
  linkedShare: number;
  /** Construction input index, a year. */
  indexRate: number;
  /** Rent you pay while waiting, a month. */
  rent: number;
  rentGrowth: number;
  /** Your own money for the purchase. */
  equity: number;
  mortgageRate: number;
  mortgageYears: number;
  /** Home prices, a year. */
  appreciation: number;
  /** Compare where you stand after this many years. */
  horizon: number;
}

export const DISCOUNTED_HOME_DEFAULTS: DiscountedHomeInputs = {
  marketPrice: 2_000_000,
  discountPct: 0.2,
  discountCap: 300_000,
  yearsToKeys: 3,
  linkedShare: 0.8,
  indexRate: 0.03,
  rent: 5_500,
  rentGrowth: 0.03,
  equity: 500_000,
  mortgageRate: IL.typicalMortgageRate / 100,
  mortgageYears: 25,
  appreciation: 0.03,
  horizon: 10,
};

export interface HomePath {
  /** What you finally pay for the apartment. */
  price: number;
  purchaseTax: number;
  loan: number;
  monthlyPayment: number;
  interestPaid: number;
  rentPaid: number;
  /** Everything paid by the horizon: equity, tax, mortgage payments and rent. */
  cashOut: number;
  homeValue: number;
  mortgageLeft: number;
  /** Home value − mortgage left − cash paid: the money this path made or cost you. */
  position: number;
}

export function discountedVsMarket(i: DiscountedHomeInputs) {
  const horizon = Math.max(i.horizon, i.yearsToKeys);
  const discount = Math.min(i.marketPrice * i.discountPct, i.discountCap);
  const base = i.marketPrice - discount;
  const indexed =
    base * (1 - i.linkedShare + i.linkedShare * Math.pow(1 + i.indexRate, i.yearsToKeys));
  const homeValue = i.marketPrice * Math.pow(1 + i.appreciation, horizon);

  const path = (price: number, startMonth: number): HomePath => {
    const purchaseTax = bracketTax(price, IL.purchaseTaxSingleHome);
    const loan = Math.max(0, price + purchaseTax - i.equity);
    const monthlyPayment = spitzer(loan, i.mortgageRate, i.mortgageYears);
    let balance = loan,
      interestPaid = 0,
      paid = 0,
      rentPaid = 0,
      rent = i.rent;
    for (let m = 1; m <= horizon * 12; m++) {
      if (m <= startMonth) {
        rentPaid += rent;
      } else if (balance > 0.01) {
        const interest = balance * (i.mortgageRate / 12);
        const pay = Math.min(monthlyPayment, balance + interest);
        interestPaid += interest;
        paid += pay;
        balance = balance + interest - pay;
      }
      if (m % 12 === 0) rent *= 1 + i.rentGrowth;
    }
    const cashOut = Math.min(i.equity, price + purchaseTax) + paid + rentPaid;
    return {
      price,
      purchaseTax,
      loan,
      monthlyPayment,
      interestPaid,
      rentPaid,
      cashOut,
      homeValue,
      mortgageLeft: balance,
      position: homeValue - balance - cashOut,
    };
  };

  const discounted = path(indexed, Math.round(i.yearsToKeys * 12));
  const market = path(i.marketPrice, 0);
  return {
    discount,
    indexation: indexed - base,
    horizon,
    discounted,
    market,
    diff: discounted.position - market.position,
  };
}
