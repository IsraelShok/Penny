"use client";
import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plane, Plus } from "lucide-react";
import { deletePlanItem, getPlan, savePlanItem } from "@/lib/api";
import { shekels } from "@/lib/money";
import {
  perPersonNight,
  TRIP_LINES,
  tripMonthly,
  tripNights,
  tripTotal,
  type Trip,
  type TripLine,
} from "@/lib/trip";
import { CardShell, CardAction } from "@/components/home/card-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Goal } from "@/lib/types";

type Draft = { id?: number; name: string; savedAmount: number; trip: Trip };
const today = () => new Date().toISOString().slice(0, 10);
const emptyDraft = (): Draft => ({
  name: "",
  savedAmount: 0,
  trip: { start: today(), end: today(), travelers: 2, lines: {} },
});

/** Vacation plans: goals of kind "vacation". `compact` shows only the next upcoming trip (for the budget page). */
export function VacationPlans({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("vacation");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["plan"], queryFn: getPlan });
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const trips = (q.data?.goals ?? []).filter(
    (g): g is Goal & { trip: Trip } => g.kind === "vacation" && !!g.trip,
  );
  const now = today();

  if (compact) {
    const next = trips.find((g) => g.trip.end >= now);
    if (!next) return null;
    const monthly = tripMonthly(next.trip, next.savedAmount, new Date());
    return (
      <CardShell
        label={t("upcoming")}
        action={<CardAction href="/journey#vacation">{t("open")}</CardAction>}
      >
        <p className="font-semibold">
          {next.name} · <bdi dir="ltr">{next.trip.start}</bdi>
        </p>
        <p className="mt-1 text-footnote text-muted-foreground">
          {next.trip.start > now
            ? t("monthlyNeeded", { amount: shekels(monthly, locale) })
            : t("happeningNow")}{" "}
          ·{" "}
          {t("savedOf", {
            saved: shekels(next.savedAmount, locale),
            total: shekels(next.targetAmount, locale),
          })}
        </p>
      </CardShell>
    );
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      await savePlanItem("goal", {
        id: draft.id,
        name: draft.name,
        savedAmount: draft.savedAmount,
        trip: draft.trip,
      });
      await qc.invalidateQueries({ queryKey: ["plan"] });
      setDraft(null);
      toast.success(t("saved"));
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: number) {
    try {
      await deletePlanItem("goal", id);
      await qc.invalidateQueries({ queryKey: ["plan"] });
    } catch {
      toast.error(t("saveFailed"));
    }
  }

  const setTrip = (patch: Partial<Trip>) =>
    draft && setDraft({ ...draft, trip: { ...draft.trip, ...patch } });
  const setLine = (k: TripLine, v: number) =>
    draft && setTrip({ lines: { ...draft.trip.lines, [k]: v } });
  const total = draft ? tripTotal(draft.trip) : 0;

  return (
    <CardShell
      id="vacation"
      label={t("title")}
      className="scroll-mt-20"
      action={
        !draft && (
          <Button size="sm" variant="outline" onClick={() => setDraft(emptyDraft())}>
            <Plus aria-hidden />
            {t("new")}
          </Button>
        )
      }
    >
      {draft ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="block space-y-1 text-sm">
            {t("name")}
            <Input
              required
              maxLength={60}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              {t("start")}
              <Input
                required
                type="date"
                dir="ltr"
                value={draft.trip.start}
                onChange={(e) => setTrip({ start: e.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              {t("end")}
              <Input
                required
                type="date"
                dir="ltr"
                min={draft.trip.start}
                value={draft.trip.end}
                onChange={(e) => setTrip({ end: e.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              {t("travelers")}
              <Input
                required
                type="number"
                min={1}
                max={30}
                value={draft.trip.travelers}
                onChange={(e) => setTrip({ travelers: Number(e.target.value) })}
              />
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">{t("lines")}</legend>
            <p className="text-xs text-muted-foreground">
              {t("estimateHint", {
                travelers: draft.trip.travelers,
                nights: tripNights(draft.trip),
              })}
            </p>
            {TRIP_LINES.map((k) => (
              <div key={k} className="grid grid-cols-[1fr_7rem_7rem] items-center gap-2 text-sm">
                <span>{t(`line_${k}`)}</span>
                <Input
                  aria-label={t(`line_${k}`)}
                  type="number"
                  min={0}
                  value={draft.trip.lines[k] ?? ""}
                  onChange={(e) => setLine(k, Number(e.target.value))}
                />
                <Input
                  aria-label={t("perPersonNightFor", { line: t(`line_${k}`) })}
                  placeholder={t("perPersonNight")}
                  type="number"
                  min={0}
                  onChange={(e) =>
                    e.target.value &&
                    setLine(
                      k,
                      perPersonNight(
                        Number(e.target.value),
                        draft.trip.travelers,
                        tripNights(draft.trip),
                      ),
                    )
                  }
                />
              </div>
            ))}
            <p className="text-sm font-semibold">
              {t("total", { amount: shekels(total, locale) })}
            </p>
          </fieldset>
          <label className="block space-y-1 text-sm">
            {t("savedSoFar")}
            <Input
              type="number"
              min={0}
              value={draft.savedAmount}
              onChange={(e) => setDraft({ ...draft, savedAmount: Number(e.target.value) })}
            />
          </label>
          <p className="text-xs text-muted-foreground">{t("assumption")}</p>
          <div className="flex gap-2">
            <Button disabled={busy || total <= 0} type="submit">
              {t("save")}
            </Button>
            <Button disabled={busy} variant="ghost" type="button" onClick={() => setDraft(null)}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <>
          {trips.length === 0 && (
            <p className="text-footnote text-pretty text-muted-foreground">{t("empty")}</p>
          )}
          <ul className="space-y-3">
            {trips.map((g) => {
              const after = g.trip.start <= now;
              const pct = Math.min(100, (g.savedAmount / g.targetAmount) * 100);
              return (
                <li key={g.id} className="rounded-xl bg-muted/50 p-4">
                  <p className="flex items-center gap-2 font-semibold">
                    <Plane className="size-4 text-primary" aria-hidden />
                    {g.name}
                  </p>
                  <p className="text-footnote text-muted-foreground">
                    <bdi dir="ltr">
                      {g.trip.start} – {g.trip.end}
                    </bdi>{" "}
                    · {t("travelersN", { n: g.trip.travelers })}
                  </p>
                  <progress
                    aria-label={g.name}
                    value={pct}
                    max={100}
                    className="mt-3 h-2 w-full accent-primary"
                  />
                  <p className="mt-1 text-sm">
                    {t("savedOf", {
                      saved: shekels(g.savedAmount, locale),
                      total: shekels(g.targetAmount, locale),
                    })}
                  </p>
                  {after ? (
                    <p className="mt-1 text-sm">
                      {t("actualVsPlanned", {
                        actual: shekels(g.actual ?? 0, locale),
                        planned: shekels(g.targetAmount, locale),
                      })}{" "}
                      <Link
                        className="text-primary hover:underline"
                        href={`/transactions?month=${g.trip.start.slice(0, 7)}`}
                      >
                        {t("categorize")}
                      </Link>
                    </p>
                  ) : (
                    <p className="mt-1 text-sm">
                      {t("monthlyNeeded", {
                        amount: shekels(tripMonthly(g.trip, g.savedAmount, new Date()), locale),
                      })}
                    </p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDraft({
                          id: g.id,
                          name: g.name,
                          savedAmount: g.openingSavedAmount ?? g.savedAmount,
                          trip: g.trip,
                        })
                      }
                    >
                      {t("edit")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void remove(g.id)}>
                      {t("delete")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </CardShell>
  );
}
