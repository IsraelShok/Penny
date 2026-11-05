"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plug, Sparkles } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { getSettings } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AINotConnectedBannerProps {
  className?: string;
}

export function AINotConnectedBanner({ className }: AINotConnectedBannerProps) {
  const t = useTranslations("aiBanner");
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    staleTime: 60_000,
  });

  if (!data || data.aiProvider !== "none") return null;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-[1.375rem] bg-card p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5",
        className
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        <Sparkles className="h-5 w-5" strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="font-serif text-base leading-tight tracking-tight">
          {t("notConnected")}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <IconButton
        label={t("connectAi")}
        variant="default"
        size="icon-sm"
        nativeButton={false}
        className="self-start sm:self-auto"
        render={<Link href="/settings/ai" />}
      >
        <Plug className="size-3.5" aria-hidden />
      </IconButton>
    </div>
  );
}
