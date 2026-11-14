"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Banknote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteCashExpense, getCashWallet, logCashExpense } from "@/lib/api";
import { shekels } from "@/lib/money";

/** Cash wallet: ATM withdrawals minus logged cash spending, with one action — log cash spending. */
export function CashWalletCard() {
  const t = useTranslations("tags");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const wallet = useQuery({ queryKey: ["cash-wallet"], queryFn: getCashWallet });
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const refresh = () => {
    for (const key of ["cash-wallet", "transactions", "transactions-summary", "summary", "home"]) void queryClient.invalidateQueries({ queryKey: [key] });
  };
  const log = useMutation({
    mutationFn: () => logCashExpense(Number(amount), note.trim() || t("cashDefault")),
    onSuccess: ({ id }) => {
      refresh();
      toast.success(t("cashLogged", { amount: shekels(Number(amount), locale) }), {
        action: { label: t("undo"), onClick: () => void deleteCashExpense(id).then(refresh) },
      });
      setAmount("");
      setNote("");
      setOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("failed")),
  });

  if (!wallet.data) return null;
  const { balance, withdrawn, days } = wallet.data;
  const valid = Number(amount) > 0;
  // No cash withdrawn lately means nothing to track: keep the page clear.
  if (Math.round(balance) === 0 && !withdrawn) return null;

  return (
    <section aria-label={t("cashTitle")} className="card-surface">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-muted" aria-hidden><Banknote className="size-4" /></span>
          <div>
            <h2 className="card-title">{t("cashTitle")}</h2>
            <p className="card-figure">{shekels(Math.round(balance), locale)}</p>
          </div>
        </div>
        {!open && <Button onClick={() => setOpen(true)}>{t("cashLog")}</Button>}
      </div>
      {open && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); if (valid) log.mutate(); }}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        >
          <Input autoFocus required type="number" inputMode="decimal" min="0.01" step="any" dir="ltr" aria-label={t("cashAmount")} placeholder="₪40" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 w-24 tabular-nums" />
          <Input aria-label={t("cashWhere")} placeholder={t("cashWherePlaceholder")} maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} className="h-9 w-40" />
          <Button type="submit" disabled={!valid || log.isPending}>{t("cashSave")}</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
        </form>
      )}
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {withdrawn > 0 ? t("cashNote", { days, withdrawn: shekels(Math.round(withdrawn), locale) }) : t("cashNoteEmpty", { days })}
      </p>
    </section>
  );
}
