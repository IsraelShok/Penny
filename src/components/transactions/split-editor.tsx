"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { translateCategoryName } from "@/lib/i18n-data";
import { shekels } from "@/lib/money";
import type { Category, TransactionWithCategory } from "@/lib/types";

export function SplitEditor({ transaction, categories, close, save }: { transaction: TransactionWithCategory; categories: Category[]; close: () => void; save: (parts: { categoryId: number; amount: number }[]) => Promise<void> }) {
  const locale = useLocale(); const he = locale === "he"; const t = useTranslations("categoriesSeeded"); const tSplit = useTranslations("split");
  const leaves = categories.filter(c => c.kind === "expense" && !categories.some(child => child.parentId === c.id));
  const [parts, setParts] = useState(() => transaction.allocations?.length ? transaction.allocations.map(a => ({ categoryId: a.categoryId, amount: String(a.amount) })) : [{ categoryId: transaction.categoryId ?? leaves[0]?.id ?? 0, amount: "" }, { categoryId: leaves[0]?.id ?? 0, amount: "" }]);
  const [busy, setBusy] = useState(false);
  const total = Math.round(Math.abs(transaction.chargedAmount) * 100);
  const sum = parts.reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0);
  const valid = parts.length >= 2 && sum === total && parts.every(p => Number(p.amount) > 0 && p.categoryId > 0);
  async function submit(remove = false) { setBusy(true); try { await save(remove ? [] : parts.map(p => ({ categoryId: p.categoryId, amount: Number(p.amount) }))); close(); } catch { /* Caller displays a localized error; keep the draft open. */ } finally { setBusy(false); } }
  return <Sheet open onOpenChange={open => { if (!open && !busy) close(); }}><SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-2xl overflow-y-auto rounded-t-3xl p-6" dir={he ? "rtl" : "ltr"}>
    <SheetTitle>{tSplit("splitExpenseAcrossCategories")}</SheetTitle><SheetDescription>{transaction.description} · {shekels(Math.abs(transaction.chargedAmount), locale)}. {tSplit("theOriginalBankTransaction")}</SheetDescription>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (valid) void submit(); }}>
      {parts.map((p, i) => <div className="grid grid-cols-[1fr_110px_auto] items-end gap-2" key={i}><label className="min-w-0 text-xs">{tSplit("category")}<select className="mt-1 min-h-11 w-full rounded-lg border bg-background px-2" value={p.categoryId} onChange={e => setParts(parts.map((x, j) => j === i ? { ...x, categoryId: Number(e.target.value) } : x))}>{leaves.map(c => <option key={c.id} value={c.id}>{translateCategoryName(c.name, t)}</option>)}</select></label><label className="text-xs">{tSplit("amount")}<Input className="mt-1" required type="number" min="0.01" step="0.01" value={p.amount} onChange={e => setParts(parts.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} /></label><Button type="button" variant="ghost" disabled={parts.length <= 2 || busy} aria-label={tSplit("removePart")} onClick={() => setParts(parts.filter((_, j) => j !== i))}>×</Button></div>)}
      <p role="status" className="text-sm">{tSplit("leftToAllocate")}{shekels((total - sum) / 100, locale)}</p>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={parts.length >= 10 || busy} onClick={() => setParts([...parts, { categoryId: leaves[0]?.id ?? 0, amount: "" }])}>{tSplit("addPart")}</Button><Button type="submit" disabled={!valid || busy}>{tSplit("saveSplit")}</Button>{!!transaction.allocations?.length && <Button type="button" variant="ghost" disabled={busy} onClick={() => void submit(true)}>{tSplit("removeSplit")}</Button>}</div>
    </form>
  </SheetContent></Sheet>;
}
