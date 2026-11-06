"use client";

import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePrivacyMode } from "@/hooks/use-privacy-mode";

export function PrivacyModeSwitch() {
  const t = useTranslations("settings.privacy");
  const [on, toggle] = usePrivacyMode();
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <Label htmlFor="privacy-mode" className="flex-1">
        {t("modeLabel")}
      </Label>
      <Switch id="privacy-mode" checked={on} onCheckedChange={toggle} />
    </div>
  );
}
