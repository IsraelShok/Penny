"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { DataState } from "@/components/ui/data-state";
import { addSettlement, getSettle, setSplitRule, undoSettlement, type SettleCounterpart } from "@/lib/api";
import { shekels } from "@/lib/money";
import type { SplitRule } from "@/lib/settle";

const field = "h-9 rounded-lg border border-border/60 bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring";
const button = "h-9 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring";

/** "התחשבנות": one card per member money is shared with. */
export function SettleLedger() {
  const t = useTranslations("settle");
  const q = useQuery({ queryKey: ["settle"], queryFn: getSettle });
  if (q.isError) return <DataState error onRetry={() => void q.refetch()} />;
  if (q.isPending) return <DataState loading />;
  if (!q.data.me || q.data.counterparts.length === 0) {
    return <p className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">{q.data.me ? t("noCounterparts") : t("noMe")}</p>;
  }
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      {q.data.counterparts.map((c) => <CounterpartCard key={c.member.id} c={c} />)}
    </div>
  );
}

function CounterpartCard({ c }: { c: SettleCounterpart }) {
  const t = useTranslations("settle");
  const locale = useLocale();
  const qc = useQueryClient();
  const money = (n: number) => shekels(Math.round(Math.abs(n)), locale);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [share, setShare] = useState(String(c.rule.myShare));
  const [support, setSupport] = useState(c.rule.support ?? { monthly: 0, direction: "pay" as const, start: today.slice(0, 7) });
  const name = c.member.name;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["settle"] });
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed"));
    }
  };
  const saveRule = (rule: SplitRule) => run(() => setSplitRule(c.member.id, rule), t("saved"));

  const balanceText = c.balance > 0.5 ? t("toYou", { name, amount: money(c.balance) })
    : c.balance < -0.5 ? t("fromYou", { name, amount: money(c.balance) })
    : t("even", { name });
  const last = c.entries[0];

  return (
    <section aria-label={name} className="rounded-2xl border border-border/60 bg-card p-4">
      <h3 className="text-base font-semibold">{name}</h3>
      <p className="mt-1 text-lg tabular-nums" aria-live="polite">{balanceText}</p>
      <p className="text-xs text-muted-foreground">{c.since ? t("since", { date: c.since }) : t("sinceStart")}</p>

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = amount === "" ? Math.abs(c.balance) : Number(amount);
          if (!Number.isFinite(n) || n < 0) return toast.error(t("invalidAmount"));
          void run(() => addSettlement(c.member.id, date, n), t("settledToast"));
          setAmount("");
        }}
      >
        <label className="grid gap-1 text-xs text-muted-foreground">{t("date")}
          <input type="date" required max={today} value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">{t("amountPaid")}
          <input type="number" min={0} step="0.01" inputMode="decimal" placeholder={String(Math.round(Math.abs(c.balance)))} value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} w-28`} />
        </label>
        <button type="submit" className={`${button} bg-primary text-primary-foreground`}>{t("settleUp")}</button>
      </form>
      {last && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {t("lastSettle", { date: last.date, amount: money(last.amount) })}
          <button type="button" className="rounded underline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => void run(() => undoSettlement(last.id), t("undone"))}>{t("undo")}</button>
        </p>
      )}

      {c.lines.length > 0 && (
        <ul className="mt-3 grid gap-1 text-sm">
          {c.lines.slice(0, 10).map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="truncate"><span className="tabular-nums text-xs text-muted-foreground" dir="ltr">{l.date}</span> {l.kind === "support" ? t("supportLine") : l.description}</span>
              <span className="tabular-nums text-muted-foreground">{l.amount > 0 ? t("lineToYou", { amount: money(l.amount) }) : t("lineFromYou", { amount: money(l.amount) })}</span>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer rounded text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">{t("rules")}</summary>
        <div className="mt-2 grid gap-3">
          <label className="flex flex-wrap items-center gap-2 text-sm">{t("myShare")}
            <input type="number" min={0} max={100} value={share} onChange={(e) => setShare(e.target.value)} className={`${field} w-20`} />%
            <button type="button" className={`${button} bg-muted`} onClick={() => {
              const n = Number(share);
              if (share === "" || !(n >= 0 && n <= 100)) return void toast.error(t("invalidShare"));
              void saveRule({ myShare: n, support: c.rule.support });
            }}>{t("save")}</button>
          </label>
          <p className="text-xs text-muted-foreground">{t("payerHint")}</p>
          <fieldset className="grid gap-2 rounded-xl border border-border/60 p-3">
            <legend className="px-1 text-sm">{t("supportTitle")}</legend>
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs text-muted-foreground">{t("monthly")}
                <input type="number" min={0} value={support.monthly || ""} onChange={(e) => setSupport({ ...support, monthly: Number(e.target.value) })} className={`${field} w-28`} />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">{t("direction")}
                <select value={support.direction} onChange={(e) => setSupport({ ...support, direction: e.target.value as "pay" | "receive" })} className={field}>
                  <option value="pay">{t("pay", { name })}</option>
                  <option value="receive">{t("receive", { name })}</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">{t("start")}
                <input type="month" value={support.start} onChange={(e) => setSupport({ ...support, start: e.target.value })} className={field} />
              </label>
              <button type="button" className={`${button} bg-muted`} onClick={() => {
                if (!(support.monthly > 0) || !support.start) return void toast.error(t("invalidAmount"));
                void saveRule({ myShare: c.rule.myShare, support });
              }}>{t("save")}</button>
              {c.rule.support && (
                <button type="button" className={`${button} text-muted-foreground`} onClick={() => void saveRule({ myShare: c.rule.myShare, support: null })}>{t("removeSupport")}</button>
              )}
            </div>
          </fieldset>
        </div>
      </details>
    </section>
  );
}
