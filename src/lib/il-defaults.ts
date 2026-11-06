/**
 * Israeli figures the app relies on, in one dated place. Update every January.
 * Sources: Israel Tax Authority, Capital Market Authority, Bank of Israel (research notes, Nov 2026).
 */
export const IL = {
  year: 2026,
  /** Monthly salary ceiling for tax-exempt study fund deposits (salaried). */
  studyFundSalaryCeiling: 15_712,
  /** Value of one tax credit point, per month. */
  creditPointMonthly: 242,
  capitalGainsTax: 0.25,
  /** Legal caps on pension fees, % from deposits / % of balance. */
  pensionFeeCap: { deposit: 6, balance: 0.5 },
  /** Years back a tax refund can be claimed (form 135). */
  taxRefundYears: 6,
  bankOfIsraelRate: 3.25,
  /** Prime = Bank of Israel rate + 1.5. */
  primeRate: 4.75,
  /** Typical prime-track mortgage rate (prime − 0.5), Nov 2026. A reference for comparison, not an offer. */
  typicalMortgageRate: 4.25,
  /**
   * Monthly income-tax brackets [upTo, rate] for 2026: indexation stays frozen, but the 2026 budget
   * widened the 20% bracket to ₪19,000 and the 31% bracket to ₪25,100. Top 50% includes the 3% surtax.
   * Sources (checked Nov 2026): simplecalc.co.il/guides/tax-brackets, mechushav.co.il/guide-madregot-mas.html.
   */
  taxBracketsMonthly: [[7_010, 0.1], [10_060, 0.14], [19_000, 0.2], [25_100, 0.31], [46_690, 0.35], [60_130, 0.47], [Infinity, 0.5]],
  /** Credit points for a resident: 2.25 (man), 2.75 (woman). Income Tax Ordinance §34, §36. */
  creditPoints: { man: 2.25, woman: 2.75 },
  /** Credit for employee pension deposits: 35% of up to 7% of salary, salary capped (ITA, 2025 figure). */
  pensionCredit: { rate: 0.35, ofSalary: 0.07, salaryCeiling: 9_700 },
  /**
   * Bituach Leumi + health tax, 2026. Rates unchanged from 2025. From 2026 the reduced-rate band is
   * indexed to the CPI from ₪7,522 (not 60% of the average wage): ₪7,703. Ceiling ₪51,910.
   * Source: btl.gov.il circulars for 2026 (בל/651, "מקדמות ודמי ביטוח לעצמאים 2026").
   */
  bituach: {
    reducedUpTo: 7_703,
    ceiling: 51_910,
    /** [reduced, full] — national insurance + health tax combined. */
    employee: [0.0104 + 0.0323, 0.07 + 0.0517],
    selfEmployed: [0.0287 + 0.0323, 0.1283 + 0.0517],
  },
  /** Mandatory pension for the self-employed (Pension Law §6B, 2017): 4.45% up to half the avg wage, 12.55% up to the full avg wage. Avg wage 2026: ₪13,769 (btl.gov.il). */
  selfEmployedPension: { averageWage: 13_769, lowRate: 0.0445, highRate: 0.1255 },
  /** VAT 18% since 1 Jan 2025 (was 17%). Bimonthly report due by the 15th of the following month. */
  vat: { rate: 0.18, dueDay: 15 },
  /**
   * Purchase tax (מס רכישה) for a single home, [upTo, marginal rate]. Brackets frozen 16.01.2024–15.01.2028
   * (not indexed). Checked Nov 2026 against secondary sources, not the ITA page itself:
   * bizportal.co.il/realestates/news/article/20038028, bscpa.co.il (מס רכישה 2026). Editable in the calculator.
   */
  purchaseTaxSingleHome: [[1_978_745, 0], [2_347_040, 0.035], [6_055_070, 0.05], [20_183_565, 0.08], [Infinity, 0.1]],
  /**
   * Amendment 190 (תיקון 190): from age 60, with a "qualifying pension" (קצבה מזכה) above the minimum,
   * a provident fund for investment can pay a tax-free annuity; a lump sum pays 15% on the real gain.
   * Minimum ₪5,306/month for 2026 per pensuni.com/?p=2795 and gilisaar.co.il (citing the Jan 2026 ITA table);
   * not checked against the ITA directly. National Insurance old-age pension does not count.
   */
  amendment190: { minAge: 60, minQualifyingPension: 5_306, lumpRealGainTax: 0.15 },
} as const;