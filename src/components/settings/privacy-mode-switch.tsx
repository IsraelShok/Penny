"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { SettingCard, SettingRow, StatusChip } from "@/components/settings/section-shell";
import { usePrivacyMode } from "@/hooks/use-privacy-mode";

export const PRIVACY_SHORTCUT = "Ctrl+Shift+P"; // not Alt+Shift: that switches keyboard language on Windows

/** Ctrl+Shift+P (⌘⇧P on Mac) anywhere (not while typing) hides or shows amounts. Mounted once in the app shell. */
export function PrivacyHotkey() {
  const t = useTranslations("settings.privacy");
  const [, toggle] = usePrivacyMode();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // e.code, not e.key: with Alt held, macOS and Hebrew layouts change the typed character.
      if (e.code !== "KeyP" || !(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey || e.repeat)
        return;
      const el = e.target as HTMLElement | null;
      if (el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? "")) return;
      e.preventDefault();
      toggle();
      toast(
        document.documentElement.dataset.privacy === "on" ? t("modeOnToast") : t("modeOffToast"),
        { id: "privacy-mode" },
      );
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, t]);
  return null;
}

export function PrivacyModeCard() {
  const t = useTranslations("settings.privacy");
  const [on, toggle] = usePrivacyMode();
  return (
    <SettingCard
      title={t("modeTitle")}
      description={t("modeDescription")}
      aside={<StatusChip on={on} label={on ? t("statusOn") : t("statusOff")} />}
    >
      <SettingRow
        label={t("modeLabel")}
        htmlFor="privacy-mode"
        hint={
          <>
            {t("shortcutLabel")}{" "}
            <kbd dir="ltr" className="rounded border border-border px-1.5 font-sans">
              {PRIVACY_SHORTCUT}
            </kbd>
          </>
        }
      >
        <Switch
          id="privacy-mode"
          checked={on}
          onCheckedChange={toggle}
          aria-keyshortcuts="Control+Shift+P Meta+Shift+P"
        />
      </SettingRow>
    </SettingCard>
  );
}
