import "server-only";

import type { Rule } from "./engine";

const FIELDS = ["merchant", "amount", "account"];
const OPS = ["contains", "equals", "regex", "gt", "lt"];
const KINDS = ["expense", "income", "transfer"];

/** Shape-checks a rule from a request body; returns null when invalid. Deeper checks live in createRule/validateRule. */
export function parseRuleBody(body: Record<string, unknown> | null): Omit<Rule, "id"> | null {
  if (
    !body ||
    !FIELDS.includes(body.field as string) ||
    !OPS.includes(body.op as string) ||
    typeof body.value !== "string" ||
    body.value.trim() === "" ||
    body.value.length > 200 ||
    (body.categoryId != null && !Number.isInteger(body.categoryId)) ||
    (body.kind != null && !KINDS.includes(body.kind as string)) ||
    (body.categoryId == null && body.kind == null)
  ) {
    return null;
  }
  return {
    field: body.field as Rule["field"],
    op: body.op as Rule["op"],
    value: body.value.trim(),
    categoryId: (body.categoryId as number | undefined) ?? undefined,
    kind: (body.kind as Rule["kind"]) ?? undefined,
  };
}
