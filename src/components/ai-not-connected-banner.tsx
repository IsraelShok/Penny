"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getSettings } from "@/lib/api";
import { cn } from "@/lib/utils";
export function AINotConnectedBanner({ className }: { className?: string }) {
  const t = useTranslations("aiBanner");
  const { data } = useQuery({ queryKey: ["settings"], queryFn: getSettings, staleTime: 60_000 });
  if (!data || data.aiProvider !== "none") return null;
  return <details className={cn("rounded-xl border border-border/60 px-4 py-3 text-sm", className)}>
    <summary className="cursor-pointer rounded-md py-1 text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">{t("optionalTitle")}</summary>
    <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{t("manualHint")}</p>
    <Link href="/settings/ai" className="mt-2 inline-flex min-h-11 items-center rounded-lg text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{t("connectAi")}</Link>
  </details>;
}
