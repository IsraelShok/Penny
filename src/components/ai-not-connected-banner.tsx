"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getSettings } from "@/lib/api";
import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";
export function AINotConnectedBanner({ className }: { className?: string }) {
  const t = useTranslations("aiBanner");
  const { data } = useQuery({ queryKey: ["settings"], queryFn: getSettings, staleTime: 60_000 });
  if (!data || data.aiProvider !== "none") return null;
  // Compact: the title, an "i" with the explanation, and the one action.
  return <div className={cn("flex flex-wrap items-center gap-x-1 rounded-xl border border-border/60 ps-4 pe-2 text-sm", className)}>
    <span className="text-muted-foreground">{t("optionalTitle")}</span>
    <InfoTip text={t("manualHint")} />
    <Link href="/settings/ai" className="ms-auto inline-flex min-h-11 items-center rounded-lg px-2 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{t("connectAi")}</Link>
  </div>;
}
