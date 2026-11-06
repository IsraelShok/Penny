import { expect, it } from "vitest";
import { renewalIn } from "@/lib/renewals";

it("counts months and days to the renewal month", () => {
  const today = new Date(2026, 10, 6); // 6 Nov 2026
  expect(renewalIn("2026-12", today)).toEqual({ months: 1, days: 25 });
  expect(renewalIn("2027-11", today).months).toBe(12);
  expect(renewalIn("2026-10", today).months).toBe(-1);
});
