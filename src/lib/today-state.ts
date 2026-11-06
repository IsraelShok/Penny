/** Never turn missing or failed data into reassurance or a setup prompt. */
export function todayState(input: {
  pending: boolean;
  failed: boolean;
  hasCash: boolean;
  balance: number | null;
  connected: boolean;
  checkedThisWeek: boolean;
  needsReview: boolean;
  hasSuggestions: boolean;
}) {
  if (input.failed) return "error";
  if (input.pending || !input.hasCash) return "loading";
  if (input.balance == null) return input.connected ? "sync" : "connect";
  if (input.balance < 0) return "cash";
  if (!input.checkedThisWeek) return "checkin";
  if (input.needsReview) return "review";
  if (input.hasSuggestions) return "suggestions";
  return "done";
}
