"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Download, X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

interface Update {
  current: string;
  latest: string;
  url: string;
  install: "desktop" | "docker" | "source";
}

const KEY = "penny.updateDismissed";

/** One quiet row when a newer release exists; "Not now" hides it until the next version. */
export function UpdateBanner() {
  const t = useTranslations("update");
  const { data } = useQuery({
    queryKey: ["update"],
    queryFn: async () =>
      ((await (await fetch("/api/update")).json()) as { update: Update | null }).update,
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  });
  if (!data || dismissed === data.latest) return null;

  const hide = () => {
    setDismissed(data.latest);
    try {
      localStorage.setItem(KEY, data.latest);
    } catch {}
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-primary/10 px-4 py-2 text-footnote md:px-6"
    >
      <Download className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="font-semibold">{t("title", { version: data.latest })}</span>
      <span className="min-w-0 flex-1 text-muted-foreground">{t(`how_${data.install}`)}</span>
      <a
        href={data.url}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {t(data.install === "desktop" ? "download" : "whatsNew")}
      </a>
      <IconButton label={t("dismiss")} size="icon-sm" variant="ghost" onClick={hide}>
        <X className="size-4" aria-hidden />
      </IconButton>
    </div>
  );
}
