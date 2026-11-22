"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  createManualRecurringItem,
  deleteManualRecurring,
  getGenericPatterns,
  getManualRecurringCandidates,
  getReconcile,
  listManualRecurring,
  reconcileAction,
  setGenericPattern,
  updateManualRecurring,
  type ManualRecurring,
  type ReconcileRow,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { Locale } from "@/i18n/routing";

type Tab = "duplicates" | "pending" | "generic" | "recurring";

/** Clean-up tools for the transactions list: duplicates, stale pending rows, generic descriptions, manual recurring. */
export function CleanupSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("reconcile");
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<Tab>("duplicates");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="w-full overflow-y-auto p-4 data-[side=bottom]:max-h-[92dvh] sm:max-w-lg!"
      >
        <SheetHeader className="p-0">
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        <Segmented
          label={t("title")}
          variant="track"
          value={tab}
          onChange={setTab}
          options={(["duplicates", "pending", "generic", "recurring"] as const).map((v) => ({
            value: v,
            label: t(`tab.${v}`),
          }))}
        />
        {open && tab === "duplicates" && <Duplicates />}
        {open && tab === "pending" && <Pending />}
        {open && tab === "generic" && <Generic />}
        {open && tab === "recurring" && <Recurring />}
      </SheetContent>
    </Sheet>
  );
}

/** Runs a reconcile action, refreshes, and offers a 5-second undo. */
function useReconcile() {
  const t = useTranslations("reconcile");
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["reconcile"] });
    void qc.invalidateQueries({ queryKey: ["transactions"] });
    void qc.invalidateQueries({ queryKey: ["insights"] });
  };
  return (body: Parameters<typeof reconcileAction>[0], done: string) =>
    reconcileAction(body).then(
      ({ undoToken }) => {
        refresh();
        toast.success(done, {
          duration: 5000,
          action: undoToken
            ? {
                label: t("undo"),
                onClick: () =>
                  void reconcileAction({ action: "undo", token: undoToken }).then(refresh, () =>
                    toast.error(t("failed")),
                  ),
              }
            : undefined,
        });
      },
      (e: unknown) => toast.error(e instanceof Error ? e.message : t("failed")),
    );
}

function RowLine({ r, keep, locale }: { r: ReconcileRow; keep: boolean; locale: Locale }) {
  const t = useTranslations("reconcile");
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="min-w-0 flex-1 truncate" title={r.description}>
        {r.description}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatDate(r.date)} · {t(r.status === "pending" ? "pendingLabel" : "bookedLabel")}
        {r.provider === "file" ? ` · ${t("fileLabel")}` : ""}
        {keep ? ` · ${t("keepLabel")}` : ""}
      </span>
      <bdi className="w-20 shrink-0 text-end tabular-nums" data-money>
        {formatCurrency(r.amount, r.currency, locale)}
      </bdi>
    </div>
  );
}

function Duplicates() {
  const t = useTranslations("reconcile");
  const locale = useLocale() as Locale;
  const act = useReconcile();
  const q = useQuery({ queryKey: ["reconcile", 14], queryFn: () => getReconcile(14) });
  if (!q.data) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  if (!q.data.pairs.length) return <p className="text-sm text-muted-foreground">{t("noPairs")}</p>;
  return (
    <ul className="grid gap-3" aria-label={t("tab.duplicates")}>
      {q.data.pairs.map(({ a, b, keepId }) => {
        const dropId = keepId === a.id ? b.id : a.id;
        return (
          <li key={`${a.id}-${b.id}`} className="grid gap-2 rounded-xl border border-border p-3">
            <RowLine r={a} keep={a.id === keepId} locale={locale} />
            <RowLine r={b} keep={b.id === keepId} locale={locale} />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void act({ action: "merge", keepId, dropId }, t("merged"))}
              >
                {t("merge")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void act({ action: "dismiss", ids: [a.id, b.id] }, t("dismissed"))}
              >
                {t("notDuplicate")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void act({ action: "remove", ids: [dropId] }, t("removed"))}
              >
                {t("removeOther")}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Pending() {
  const t = useTranslations("reconcile");
  const locale = useLocale() as Locale;
  const act = useReconcile();
  const [days, setDays] = useState(14);
  const q = useQuery({ queryKey: ["reconcile", days], queryFn: () => getReconcile(days) });
  const stale = q.data?.stale ?? [];
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="stale-days">{t("staleDays")}</Label>
        <Input
          id="stale-days"
          type="number"
          min={1}
          max={365}
          className="w-20"
          value={days}
          onChange={(e) => setDays(Math.min(365, Math.max(1, Number(e.target.value) || 1)))}
        />
      </div>
      {!stale.length ? (
        <p className="text-sm text-muted-foreground">{t("noStale")}</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {stale.map((r) => (
              <li key={r.id} className="flex min-h-10 items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{r.description}</span>
                <span className="text-xs text-muted-foreground">{formatDate(r.date)}</span>
                <bdi className="w-20 text-end tabular-nums" data-money>
                  {formatCurrency(r.amount, "ILS", locale)}
                </bdi>
              </li>
            ))}
          </ul>
          <Button
            variant="destructive"
            onClick={() => {
              if (!window.confirm(t("confirmClear", { count: stale.length }))) return;
              void act(
                { action: "remove", ids: stale.map((r) => r.id) },
                t("cleared", { count: stale.length }),
              );
            }}
          >
            {t("clearStale", { count: stale.length })}
          </Button>
        </>
      )}
    </div>
  );
}

function Generic() {
  const t = useTranslations("reconcile");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["generic-patterns"], queryFn: getGenericPatterns });
  const [text, setText] = useState("");
  const refresh = () => void qc.invalidateQueries({ queryKey: ["generic-patterns"] });
  const fail = () => toast.error(t("failed"));
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{t("genericHelp")}</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          void setGenericPattern(text).then(() => {
            setText("");
            refresh();
          }, fail);
        }}
      >
        <Input
          aria-label={t("genericPattern")}
          placeholder={t("genericPlaceholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={80}
        />
        <Button type="submit">{t("add")}</Button>
      </form>
      <ul className="divide-y divide-border">
        {(q.data?.patterns ?? []).map((p) => (
          <li key={p} className="flex min-h-10 items-center gap-2 text-sm">
            <span className="flex-1">{p}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void setGenericPattern(p, true).then(() => {
                  refresh();
                  toast.success(t("genericRemoved"), {
                    duration: 5000,
                    action: {
                      label: t("undo"),
                      onClick: () => void setGenericPattern(p).then(refresh, fail),
                    },
                  });
                }, fail)
              }
            >
              {t("remove")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Recurring() {
  const t = useTranslations("reconcile");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["manual-recurring"], queryFn: listManualRecurring });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["manual-recurring"] });
    void qc.invalidateQueries({ queryKey: ["insights"] });
  };
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : t("failed"));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [cadence, setCadence] = useState<"weekly" | "monthly" | "yearly">("monthly");
  return (
    <div className="grid gap-4">
      <form
        className="grid gap-2 rounded-xl border border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void createManualRecurringItem({
            name,
            cadence,
            amount: amount ? Number(amount) : null,
            dayOfMonth: day ? Number(day) : null,
            startDate: today,
          }).then(() => {
            setName("");
            setAmount("");
            setDay("");
            refresh();
          }, fail);
        }}
      >
        <Label htmlFor="mr-name">{t("seriesName")}</Label>
        <Input id="mr-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <Segmented
          label={t("cadence")}
          variant="track"
          value={cadence}
          onChange={setCadence}
          options={(["weekly", "monthly", "yearly"] as const).map((v) => ({
            value: v,
            label: t(`cadences.${v}`),
          }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor="mr-amount">{t("amount")}</Label>
            <Input
              id="mr-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="mr-day">{t("day")}</Label>
            <Input
              id="mr-day"
              type="number"
              min={1}
              max={31}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
        </div>
        <Button type="submit">{t("create")}</Button>
      </form>
      {(q.data?.items ?? []).map((item) => (
        <SeriesCard key={item.id} item={item} refresh={refresh} fail={fail} />
      ))}
    </div>
  );
}

function SeriesCard({
  item,
  refresh,
  fail,
}: {
  item: ManualRecurring;
  refresh: () => void;
  fail: (e: unknown) => void;
}) {
  const t = useTranslations("reconcile");
  const locale = useLocale() as Locale;
  const [picking, setPicking] = useState(false);
  const candidates = useQuery({
    queryKey: ["manual-recurring", item.id, "candidates"],
    queryFn: () => getManualRecurringCandidates(item.id),
    enabled: picking,
  });
  const patch = (body: Parameters<typeof updateManualRecurring>[1]) =>
    void updateManualRecurring(item.id, body).then(() => {
      refresh();
      void candidates.refetch();
    }, fail);
  const money = (n: number) => formatCurrency(n, item.currency, locale);
  return (
    <section className="grid gap-2 rounded-xl border border-border p-3" aria-label={item.name}>
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate font-semibold">{item.name}</h3>
        <span className="text-xs text-muted-foreground">{t(`cadences.${item.cadence}`)}</span>
        <bdi className="tabular-nums" data-money>
          {money(item.series.expectedAmount)}
        </bdi>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label={t("amount")}
          type="number"
          min={0}
          step="0.01"
          placeholder={t("fromCharges")}
          defaultValue={item.amount ?? ""}
          onBlur={(e) => {
            const v = e.target.value ? Number(e.target.value) : null;
            if (v !== item.amount) patch({ amount: v });
          }}
        />
        <Input
          aria-label={t("day")}
          type="number"
          min={1}
          max={31}
          placeholder={t("fromCharges")}
          defaultValue={item.dayOfMonth ?? ""}
          onBlur={(e) => {
            const v = e.target.value ? Number(e.target.value) : null;
            if (v !== item.dayOfMonth) patch({ dayOfMonth: v });
          }}
        />
      </div>
      <ul className="divide-y divide-border text-sm">
        {item.transactions.map((x) => (
          <li key={x.id} className="flex min-h-9 items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{x.description}</span>
            <span className="text-xs text-muted-foreground">{formatDate(x.date)}</span>
            <bdi className="tabular-nums" data-money>
              {money(x.amount)}
            </bdi>
            <Button size="sm" variant="ghost" onClick={() => patch({ detach: x.id })}>
              {t("detach")}
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setPicking((p) => !p)}>
          {t("attach")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            void deleteManualRecurring(item.id).then(() => {
              refresh();
              toast.success(t("seriesDeleted"), {
                duration: 5000,
                action: {
                  label: t("undo"),
                  onClick: () =>
                    void updateManualRecurring(item.id, { restore: true }).then(refresh, fail),
                },
              });
            }, fail)
          }
        >
          {t("remove")}
        </Button>
      </div>
      {picking && (
        <ul className="divide-y divide-border text-sm" aria-label={t("attach")}>
          {(candidates.data?.candidates ?? []).map((c) => (
            <li key={c.id} className="flex min-h-9 items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{c.description}</span>
              <span className="text-xs text-muted-foreground">{formatDate(c.date)}</span>
              <bdi className="tabular-nums" data-money>
                {money(c.amount)}
              </bdi>
              <Button size="sm" variant="ghost" onClick={() => patch({ attach: c.id })}>
                {t("add")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
