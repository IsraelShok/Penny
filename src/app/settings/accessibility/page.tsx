"use client";

import { useTranslations } from "next-intl";
import { SectionShell, SettingCard } from "@/components/settings/section-shell";
import { A11yOptions } from "@/components/a11y/a11y-menu";

export default function AccessibilitySettingsPage() {
  const t = useTranslations("a11y");
  return (
    <SectionShell title={t("title")}>
      <p className="text-sm text-muted-foreground">{t("settingsDescription")}</p>
      <SettingCard>
        <div className="py-2"><A11yOptions idPrefix="a11y-settings" /></div>
      </SettingCard>
    </SectionShell>
  );
}
