"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { getWellbeing, saveWellbeing } from "@/lib/api";
import { WELLBEING_ITEMS, wellbeingBand } from "@/lib/wellbeing";
import { CardShell } from "@/components/home/card-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function WellbeingView() {
  const t = useTranslations("wellbeing");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const history = useQuery({ queryKey: ["wellbeing"], queryFn: getWellbeing });
  const [answers, setAnswers] = useState<(number | null)[]>(WELLBEING_ITEMS.map(() => null));
  const [done, setDone] = useState(false);
  const save = useMutation({
    mutationFn: () => saveWellbeing(answers as number[]),
    onSuccess: (data) => {
      queryClient.setQueryData(["wellbeing"], data);
      setDone(true);
    },
    onError: () => toast.error(t("saveFailed")),
  });
  const complete = answers.every((a) => a != null);
  const entries = history.data ?? [];
  const latest = done ? entries.at(-1) : undefined;
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(`${iso}T12:00:00`),
    );

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      {latest ? (
        <CardShell wallet label={t("scoreLabel")}>
          <p className="figure text-[3.5rem] leading-none tabular-nums">{latest.score}</p>
          <p className="mt-4 text-lg leading-relaxed text-pretty">
            {t(`band_${wellbeingBand(latest.score)}`)}
          </p>
          <p className="mt-3 text-caption text-pretty text-muted-foreground">{t("scoreNote")}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-5 self-start"
            onClick={() => {
              setAnswers(WELLBEING_ITEMS.map(() => null));
              setDone(false);
            }}
          >
            {t("again")}
          </Button>
        </CardShell>
      ) : (
        <CardShell>
          <p className="text-footnote leading-relaxed text-pretty text-muted-foreground">
            {t("intro")}
          </p>
          <form
            className="mt-5 space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (complete) save.mutate();
            }}
          >
            {WELLBEING_ITEMS.map((item, i) => (
              <fieldset key={item.id}>
                <legend className="mb-3 text-base font-semibold leading-relaxed text-pretty">
                  {i + 1}. {t(`q_${item.id}`)}
                </legend>
                <div className="grid gap-2 sm:grid-cols-5">
                  {[0, 1, 2, 3, 4].map((o) => (
                    <label
                      key={o}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-border px-3 py-2 text-center text-footnote has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                        answers[i] === o
                          ? "border-foreground bg-foreground text-background"
                          : "hover:bg-accent",
                      )}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name={item.id}
                        checked={answers[i] === o}
                        onChange={() => setAnswers(answers.map((a, j) => (j === i ? o : a)))}
                      />
                      {t(`${item.kind}_${o}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <Button type="submit" disabled={!complete || save.isPending}>
              {t("submit")}
            </Button>
          </form>
        </CardShell>
      )}

      <CardShell label={t("historyTitle")}>
        {history.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : history.isError ? (
          <p className="text-footnote text-muted-foreground">{t("loadFailed")}</p>
        ) : entries.length === 0 ? (
          <p className="text-footnote text-muted-foreground">{t("historyEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {[...entries].reverse().map((e) => (
              <li key={e.date} className="flex items-baseline justify-between gap-3 text-footnote">
                <span className="text-muted-foreground">{date(e.date)}</span>
                <span className="font-semibold tabular-nums">
                  {e.score}
                  <span className="font-normal text-muted-foreground">/100</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-caption text-pretty text-muted-foreground">{t("source")}</p>
      </CardShell>
    </div>
  );
}
