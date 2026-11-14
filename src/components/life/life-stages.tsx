"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useHousehold } from "@/hooks/use-household";
import { getLifeProgress, saveLifeProgress } from "@/lib/api";
import { LIFE_STAGES, relevantStages, type L, type LifeStage } from "@/lib/life-stages";
import { LifeHero } from "@/components/ui/page-hero";
import { cn } from "@/lib/utils";

type Progress = Record<string, string[]>;

export function LifeStages() {
  const t = useTranslations("life");
  const lang = useLocale() === "en" ? "en" : "he";
  const tx = (l: L) => l[lang];
  const qc = useQueryClient();
  const { household, loading } = useHousehold();
  const { data: progress = {}, isPending, isError, refetch } = useQuery({ queryKey: ["life-progress"], queryFn: getLifeProgress });
  const save = useMutation({
    mutationFn: saveLifeProgress,
    onMutate: (next: Progress) => {
      const prev = qc.getQueryData<Progress>(["life-progress"]);
      qc.setQueryData(["life-progress"], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => { qc.setQueryData(["life-progress"], ctx?.prev); toast.error(t("saveFailed")); },
  });

  const nowIds = relevantStages(household).slice(0, 3);
  const now = nowIds.map((id) => LIFE_STAGES.find((s) => s.id === id)!);

  function toggle(stage: string, item: string, done: boolean) {
    const cur = progress[stage] ?? [];
    save.mutate({ ...progress, [stage]: done ? [...cur, item] : cur.filter((i) => i !== item) });
  }

  // Every stage card is always open: no folding.
  const row = (s: LifeStage) => {
    const done = (progress[s.id] ?? []).length;
    return (
      <li key={s.id} className="overflow-hidden rounded-2xl bg-card">
        <div className="px-5 py-4">
          <h3 className="text-[15px] font-semibold">{tx(s.title)}</h3>
          <p className="text-[13px] text-muted-foreground">{t("progress", { done, total: s.items.length })}</p>
        </div>
          <div className="space-y-4 border-t border-border/60 px-5 py-4">
            <p className="text-[15px] leading-relaxed">{tx(s.intro)}</p>
            <ul className="space-y-2">
              {s.items.map((i) => {
                const checked = (progress[s.id] ?? []).includes(i.id);
                return (
                  <li key={i.id}>
                    <label className="flex cursor-pointer items-start gap-3 text-[15px]">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-[var(--foreground)]"
                        checked={checked}
                        onChange={(e) => toggle(s.id, i.id, e.target.checked)}
                      />
                      <span className={cn(checked && "text-muted-foreground line-through")}>{tx(i.text)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {s.links.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[13px] font-semibold text-muted-foreground">{t("linksTitle")}</h3>
                <ul className="space-y-2">
                  {s.links.map((l) => (
                    <li key={l.url}>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[15px] text-primary underline-offset-2 hover:underline focus-visible:underline">
                        {tx(l.title)} <ExternalLink className="size-3.5" aria-hidden />
                        <span className="sr-only">{t("newTab")}</span>
                      </a>
                      <span className="block text-[12px] text-muted-foreground">
                        {t("source", { source: t(l.source === "gov" ? "sourceGov" : "sourceKolzchut"), date: l.lastChecked })}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-[12px] text-muted-foreground">{t("linksNote")}</p>
              </div>
            )}
            <p className="rounded-2xl bg-muted/60 px-4 py-3 text-[13px] text-muted-foreground">{t(s.gentle ? "footerGentle" : "footer")}</p>
          </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <LifeHero loading={loading || isPending} error={isError} onRetry={() => refetch()} stage={now[0] && tx(now[0].title)} done={now[0] ? (progress[now[0].id] ?? []).length : 0} total={now[0]?.items.length ?? 0} />
      <section aria-labelledby="life-now" className="space-y-3">
        <h2 id="life-now" className="text-[17px] font-semibold">{t("nowTitle")}</h2>
        {loading ? null : now.length ? (
          <ul className="space-y-3">{now.map((s) => row(s))}</ul>
        ) : (
          <p className="text-[15px] text-muted-foreground">{t("nowEmpty")}</p>
        )}
      </section>
      <section aria-labelledby="life-all" className="space-y-3">
        <h2 id="life-all" className="text-[17px] font-semibold">{t("allTitle")}</h2>
        <ul className="space-y-3">{LIFE_STAGES.filter((s) => !nowIds.includes(s.id)).map((s) => row(s))}</ul>
      </section>
    </div>
  );
}
