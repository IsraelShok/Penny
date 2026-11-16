"use client";

import { Switch } from "@/components/ui/switch";
import { usePlan } from "@/hooks/use-plan";
import { Segmented } from "@/components/ui/segmented";
import { HOME_STYLES, type HomeStyle } from "@/lib/plan";
import { useState } from "react";
import { Check, Palette } from "lucide-react";

import { useRouter } from "next/navigation";
import { StudioEditor } from "@/components/dashboard/studio-editor";
import { PetCustomizer } from "@/components/home/pet-card";
import { studioCopy } from "@/components/dashboard/studio-copy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { InfoTip } from "@/components/ui/info-tip";
import { SectionShell, SettingCard, SettingList, SettingRow } from "@/components/settings/section-shell";
import { getSettings, updateSettings } from "@/lib/api";
import type { AppSettings } from "@/lib/types";

type Lang = "en" | "he";

export default function AppearanceSettingsPage() {
  const t = useTranslations("settings.appearance");
  const tCommon = useTranslations("common");

  const router = useRouter();
  const queryClient = useQueryClient();
  const locale = useLocale() as Lang;
  const c = studioCopy(locale);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });
  const storedLang: Lang = settings?.language ?? locale;

  const mutation = useMutation({
    mutationFn: (next: Lang) =>
      updateSettings({ language: next } as Partial<AppSettings>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success(tCommon("saved"));
      router.refresh();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : tCommon("tryAgain"));
    },
  });

  const langOptions: { value: Lang; label: string; description: string }[] = [
    { value: "en", label: t("languageEnglish"), description: t("languageEnglishDesc") },
    { value: "he", label: t("languageHebrew"), description: t("languageHebrewDesc") },
  ];

  return (
    <SectionShell title={t("title")} description={t("description")} icon={<Palette aria-hidden />}>
      <SettingCard title={t("languageCardTitle")} description={t("languageCardDescription")}>
        <div role="radiogroup" aria-label={t("languageCardTitle")} className="divide-y divide-border">
          {langOptions.map((o) => {
            const isActive = (mutation.isPending ? mutation.variables : storedLang) === o.value; // optimistic; reverts on error
            const isPending = mutation.isPending && mutation.variables === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => {
                  if (storedLang === o.value || mutation.isPending) return;
                  mutation.mutate(o.value);
                }}
                disabled={mutation.isPending}
                className="flex min-h-11 w-full items-center gap-3 py-2.5 text-start first:pt-0 last:pb-0 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium" dir={o.value === "he" ? "rtl" : "ltr"}>{o.label}</span>
                  <span className="block text-footnote text-muted-foreground">{isPending ? t("languageSaving") : o.description}</span>
                </span>
                {isActive && <Check className="size-5 text-primary" aria-hidden />}
              </button>
            );
          })}
        </div>
      </SettingCard>

      <ComfortCard />

      <PetSettingsCard />

      <section>
        <div className="mb-2 flex items-center gap-1 px-4"><h3 className="text-sm font-semibold text-muted-foreground">{c.globalSettings}</h3><InfoTip text={c.studioHint} /></div>
        <StudioEditor inline />
      </section>

      <AboutCard />
    </SectionShell>
  );
}

/** Autosave for plan switches: toast on save; on failure usePlan puts the old value back. */
function useSavePlan() {
  const tCommon = useTranslations("common");
  const { update } = usePlan();
  return (patch: Parameters<typeof update>[0]) =>
    update(patch).then(
      () => { toast.success(tCommon("saved")); },
      (err) => { toast.error(err instanceof Error ? err.message : tCommon("tryAgain")); throw err; },
    );
}

/** Focus settings: fewer moving parts for people who lose their place easily. */
function ComfortCard() {
  const t = useTranslations("settings.appearance");
  const { plan, loaded } = usePlan();
  const update = useSavePlan();
  // Show the picked style at once; it follows plan.homeStyle again once saved (or if saving fails).
  const [picked, setPicked] = useState<HomeStyle | null>(null);
  if (picked && picked === plan.homeStyle) setPicked(null);
  // Never saved: Home renders classic (it only checks for "companion"), so show that.
  const homeStyle: HomeStyle = picked ?? plan.homeStyle ?? "classic";
  const rows = [
    { key: "simpleMode", label: t("simpleMode"), hint: t("simpleModeHint") },
    { key: "wheelPaging", label: t("wheelPaging"), hint: t("wheelPagingHint") },
  ] as const;
  return (
    <SettingCard title={t("comfortTitle")} description={t("comfortDescription")}>
      <SettingList>
        <SettingRow label={t("homeStyle")} hint={t(`homeStyleHint_${homeStyle}`)}>
          <Segmented label={t("homeStyle")} value={homeStyle} onChange={(next) => { if (!loaded || next === homeStyle) return; setPicked(next); update({ homeStyle: next }).catch(() => setPicked(null)); }}
            options={HOME_STYLES.map((s) => ({ value: s, label: t(`homeStyle_${s}`) }))} />
        </SettingRow>
        {rows.map((r) => (
          <SettingRow key={r.key} label={r.label} hint={r.hint} htmlFor={`comfort-${r.key}`}>
            <Switch id={`comfort-${r.key}`} checked={plan[r.key]} disabled={!loaded} onCheckedChange={(v) => void update({ [r.key]: v }).catch(() => {})} />
          </SettingRow>
        ))}
      </SettingList>
    </SettingCard>
  );
}

/** Pocket Pal: its own section, apart from the app's look, with the customization right under the switch. */
function PetSettingsCard() {
  const t = useTranslations("settings.appearance");
  const { plan, loaded } = usePlan();
  const update = useSavePlan();
  return (
    <SettingCard title={t("petMode")} description={t("petModeHint")}>
      <SettingList>
        <SettingRow label={t("petShow")} htmlFor="pet-mode">
          <Switch id="pet-mode" checked={plan.pet.enabled} disabled={!loaded} onCheckedChange={(v) => void update({ pet: { ...plan.pet, enabled: v } }).catch(() => {})} />
        </SettingRow>
        {plan.pet.enabled && <div className="pt-4 pb-2"><PetCustomizer /></div>}
      </SettingList>
    </SettingCard>
  );
}

/** Credits for open-source pieces shown in the app. */
function AboutCard() {
  const t = useTranslations("settings.appearance");
  return (
    <SettingCard title={t("aboutTitle")}>
      <div className="space-y-2 text-sm">
        <p>{t("boopCredit")}</p>
        <p className="text-xs text-muted-foreground">{t("boopLicense")}</p>
        <a href="https://github.com/CX-ArtLab/boopface" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">{t("boopRepo")}</a>
      </div>
    </SettingCard>
  );
}
