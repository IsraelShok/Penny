"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { CategoryPicker } from "@/components/dashboard/category-picker";
import { NewCategoryDialog } from "@/components/settings/new-category-dialog";
import { OwnerPicker } from "@/components/transactions/owner-picker";
import { useIsMobile } from "@/hooks/use-mobile";
import { createManualTransaction, deleteManualTransaction, getCategories, getOwners, updateTransactionFields, type ManualTransactionInput } from "@/lib/api";
import { translateCategoryName } from "@/lib/i18n-data";
import type { TransactionWithCategory } from "@/lib/types";
import type { HouseholdMember } from "@/lib/household";

export const isManualTxn = (txn: Pick<TransactionWithCategory, "provider">) => txn.provider === "cash" || txn.provider === "manual";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

/** Deletes a manual row with a 5-second undo toast (undo re-creates it). Shared by the sheet and bulk delete. */
export async function deleteWithUndo(ids: number[], t: (k: string, v?: Record<string, number>) => string, refresh: () => void) {
  const deleted = await Promise.all(ids.map((id) => deleteManualTransaction(id).then((r) => r.deleted)));
  refresh();
  toast.success(ids.length > 1 ? t("bulkDeleted", { count: ids.length }) : t("deleted"), {
    duration: 5000,
    action: { label: t("undo"), onClick: () => void Promise.all(deleted.map(createManualTransaction)).then(refresh, () => toast.error(t("failed"))) },
  });
}

/** Add (txn = null) or edit sheet. Manual rows: every field. Bank rows: display fields only, amount/date locked. */
export function TransactionSheet({ open, onOpenChange, txn, members = [] }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  txn: TransactionWithCategory | null;
  members?: HouseholdMember[];
}) {
  const isMobile = useIsMobile();
  // Keep showing the last row while the sheet animates closed (the parent clears txn on close).
  const [shown, setShown] = useState(txn);
  if (open && txn !== shown) setShown(txn);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className="max-h-[92dvh] w-full overflow-y-auto p-0 sm:max-w-md!">
        <Form key={shown?.id ?? "new"} txn={shown} members={members} close={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function Form({ txn, members, close }: { txn: TransactionWithCategory | null; members: HouseholdMember[]; close: () => void }) {
  const t = useTranslations("manualTxn");
  const tTags = useTranslations("tags");
  const tCat = useTranslations("categoriesSeeded");
  const tSettingsCat = useTranslations("settings.categories");
  const queryClient = useQueryClient();
  const manual = !txn || isManualTxn(txn);
  const [kind, setKind] = useState<"expense" | "income">(txn ? (txn.chargedAmount > 0 ? "income" : "expense") : "expense");
  const [amount, setAmount] = useState(txn ? String(Math.abs(txn.chargedAmount)) : "");
  const [date, setDate] = useState(txn ? txn.date.slice(0, 10) : today());
  const [description, setDescription] = useState(txn?.description ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(txn?.allocations?.length ? null : txn?.categoryId ?? null);
  const [account, setAccount] = useState(txn?.accountNumber ?? "cash");
  const [memo, setMemo] = useState(txn?.memo ?? "");
  const [tags, setTags] = useState((txn?.tags ?? []).join(", "));
  const [owner, setOwner] = useState<string | null>(txn?.owner ?? null);
  const [excluded, setExcluded] = useState(txn?.isExcluded ?? false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [newCat, setNewCat] = useState(false);

  const categories = useQuery({ queryKey: ["categories", kind], queryFn: () => getCategories(kind) }).data ?? [];
  const accounts = useQuery({ queryKey: ["owners", "accounts"], queryFn: () => getOwners(today(), today()), enabled: manual }).data?.accounts ?? [];
  const category = categories.find((c) => c.id === categoryId);
  const refresh = () => void queryClient.invalidateQueries();

  const value = Number(amount.replace(",", "."));
  const amountOk = Number.isFinite(value) && value > 0 && value <= 10_000_000;

  async function save() {
    if (manual && (!amountOk || !date || !description.trim())) return toast.error(amountOk ? t("required") : t("invalidAmount"));
    const input: ManualTransactionInput = {
      description: description.trim(), memo: memo.trim() || null, owner, excluded,
      tags: [...new Set(tags.split(",").map((s) => s.trim()).filter(Boolean))],
      ...(manual ? { kind, amount: value, date, account } : {}),
      // A split row keeps its split unless a category is picked here.
      ...(categoryId !== null || !txn?.allocations?.length ? { categoryId } : {}),
    };
    if (txn && !manual && txn.description === input.description) delete input.description;
    setBusy(true);
    try {
      if (txn) await updateTransactionFields(txn.id, input);
      else await createManualTransaction(input);
      refresh();
      toast.success(txn ? t("saved") : t("added"));
      close();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("failed")); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!txn) return;
    setBusy(true);
    try { await deleteWithUndo([txn.id], t, refresh); close(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("failed")); }
    finally { setBusy(false); }
  }

  const field = "flex flex-col gap-1.5";
  const control = "h-11 w-full rounded-lg border bg-background px-3 text-base sm:text-sm";
  return (
    <form className="flex flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <SheetHeader className="p-0"><SheetTitle>{txn ? t("editTitle") : t("addTitle")}</SheetTitle></SheetHeader>
      {manual ? (
        <Segmented label={t("type")} value={kind} onChange={(k) => { setKind(k); setCategoryId(null); }}
          options={[{ value: "expense", label: t("expense") }, { value: "income", label: t("income") }]} />
      ) : (
        <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground"><Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />{t("bankLock")}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className={field}>
          <Label htmlFor="mt-amount">{t("amount")}</Label>
          <Input id="mt-amount" className={control} inputMode="decimal" autoComplete="off" required={manual} disabled={!manual}
            aria-invalid={manual && amount !== "" && !amountOk} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className={field}>
          <Label htmlFor="mt-date">{t("date")}</Label>
          <Input id="mt-date" className={control} type="date" required={manual} disabled={!manual} max="2100-01-01" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      {manual && amount !== "" && !amountOk && <p className="-mt-2 text-xs text-destructive" role="alert">{t("invalidAmount")}</p>}
      <div className={field}>
        <Label htmlFor="mt-desc">{t("description")}</Label>
        <Input id="mt-desc" className={control} maxLength={120} required value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className={field}>
        <span className="text-sm font-medium">{t("category")}</span>
        <CategoryPicker categories={categories} currentId={categoryId} onSelect={setCategoryId} onCreate={() => setNewCat(true)} createLabel={tSettingsCat("newCategoryButton")}
          trigger={<span className={`${control} flex cursor-pointer items-center gap-2`}>
            {category && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />}
            <span className="truncate">{category ? translateCategoryName(category.name, tCat) : t("noCategory")}</span>
          </span>} />
        <NewCategoryDialog open={newCat} onOpenChange={setNewCat} kind={kind} onCreated={(c) => setCategoryId(c.id)} />
      </div>
      {manual && (
        <div className={field}>
          <Label htmlFor="mt-account">{t("account")}</Label>
          <select id="mt-account" className={control} value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="cash">{t("cash")}</option>
            {accounts.map((a) => <option key={a.accountNumber} value={a.accountNumber}>{a.label ? `${a.label} · ${a.accountNumber}` : a.accountNumber}</option>)}
          </select>
        </div>
      )}
      <div className={field}>
        <Label htmlFor="mt-memo">{t("notes")}</Label>
        <Input id="mt-memo" className={control} maxLength={500} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </div>
      <div className={field}>
        <Label htmlFor="mt-tags">{t("tags")}</Label>
        <Input id="mt-tags" className={control} value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      {members.length >= 2 && (
        <div className="flex min-h-11 items-center justify-between gap-3">
          <span className="text-sm font-medium">{t("owner")}</span>
          <OwnerPicker label={tTags("ownerLabel")} value={owner} members={members} onChange={setOwner} />
        </div>
      )}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5" checked={excluded} onChange={(e) => setExcluded(e.target.checked)} />{t("exclude")}
      </label>
      {txn && !manual && <p className="text-xs text-muted-foreground">{t("bankNoDelete")}</p>}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button type="submit" className="h-11 flex-1" disabled={busy}>{t("save")}</Button>
        <Button type="button" variant="outline" className="h-11" onClick={close}>{t("cancel")}</Button>
        {txn && manual && (confirming
          ? <Button type="button" variant="destructive" className="h-11" disabled={busy} onClick={() => void remove()}>{t("confirmDelete")}</Button>
          : <Button type="button" variant="ghost" className="h-11 text-destructive" onClick={() => setConfirming(true)}>{t("delete")}</Button>)}
      </div>
    </form>
  );
}
