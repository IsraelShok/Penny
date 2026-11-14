"use client";

import { Switch } from "@/components/ui/switch";
import { usePlan } from "@/hooks/use-plan";
import { Segmented } from "@/components/ui/segmented";
import { HOME_STYLES, type HomeStyle } from "@/lib/plan";
import { useState } from "react";

import { useRouter } from "next/navigation";
import { StudioEditor } from "@/components/dashboard/studio-editor";
import { PetCustomizer } from "@/components/home/pet-card";
import { studioCopy } from "@/components/dashboard/studio-copy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { InfoTip } from "@/components/ui/info-tip";
import { SectionShell, SettingCard } from "@/components/settings/section-shell";
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
    <SectionShell title={t("title")} description={t("description")}>
      <SettingCard title={t("languageCardTitle")} description={t("languageCardDescription")}>
        <div className="grid gap-2 sm:grid-cols-2">
          {langOptions.map((o) => {
            const isActive = (mutation.isPending ? mutation.variables : storedLang) === o.value; // optimistic; reverts on error
            const isPending = mutation.isPending && mutation.variables === o.value;
            return (
              <button
                key={o.value}
                onClick={() => {
                  if (storedLang === o.value || mutation.isPending) return;
                  mutation.mutate(o.value);
                }}
                disabled={mutation.isPending}
                className={`rounded-xl border p-4 text-start transition-colors ${
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                } disabled:opacity-60`}
              >
                <div
                  className="font-medium"
                  dir={o.value === "he" ? "rtl" : "ltr"}
                >
                  {o.label}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {isPending ? t("languageSaving") : o.description}
                </div>
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

/** Focus settings: fewer moving parts for people who lose their place easily. */
function ComfortCard() {
  const t = useTranslations("settings.appearance");
  const { plan, update, loaded } = usePlan();
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
      <div className="divide-y divide-border">
        <div className="space-y-2 pb-3">
          <span className="block font-medium">{t("homeStyle")}</span>
          <Segmented label={t("homeStyle")} value={homeStyle} onChange={(next) => { if (!loaded || next === homeStyle) return; setPicked(next); update({ homeStyle: next }).catch(() => setPicked(null)); }}
            options={HOME_STYLES.map((s) => ({ value: s, label: t(`homeStyle_${s}`) }))} />
          <span className="block text-xs text-muted-foreground">{t(`homeStyleHint_${homeStyle}`)}</span>
        </div>
        {rows.map((r) => (
          <label key={r.key} className="flex cursor-pointer items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <span>
              <span className="block font-medium">{r.label}</span>
              <span className="text-xs text-muted-foreground">{r.hint}</span>
            </span>
            <Switch checked={plan[r.key]} disabled={!loaded} onCheckedChange={(v) => update({ [r.key]: v })} />
          </label>
        ))}
      </div>
    </SettingCard>
  );
}

/** Pocket Pal: its own section, apart from the app's look, with the customization right under the switch. */
function PetSettingsCard() {
  const t = useTranslations("settings.appearance");
  const { plan, update, loaded } = usePlan();
  return (
    <SettingCard title={t("petMode")} description={t("petModeHint")}>
      <div className="divide-y divide-border">
        <label className="flex cursor-pointer items-center justify-between gap-4 pb-3 last:pb-0">
          <span className="font-medium">{t("petMode")}</span>
          <Switch checked={plan.pet.enabled} disabled={!loaded} onCheckedChange={(v) => update({ pet: { ...plan.pet, enabled: v } })} />
        </label>
        {plan.pet.enabled && <div className="pt-4 pb-2"><PetCustomizer /></div>}
      </div>
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
