"use client";

import { Download, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { SettingCard } from "@/components/settings/section-shell";

export function ExportCard() {
  const t = useTranslations("settings.data");
  return (
    <SettingCard title={t("exportTitle")} description={t("exportDescription")}>
      {/* A CSV is readable by anyone who gets the file; the encrypted backup is the safe way to keep a copy. */}
      <p className="mb-3 flex items-start gap-2 text-footnote text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--status-heads-up)]" aria-hidden />
        <span>{t("exportPlaintextWarning")}</span>
      </p>
      <a
        href="/api/data/export"
        download
        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        <Download className="size-4" aria-hidden />
        {t("exportButton")}
      </a>
      <a
        href="/api/data/export?format=ofx"
        download
        className="ms-2 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        <Download className="size-4" aria-hidden />
        {t("exportOfx")}
      </a>
    </SettingCard>
  );
}
