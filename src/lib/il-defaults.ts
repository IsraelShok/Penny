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
} as const;
