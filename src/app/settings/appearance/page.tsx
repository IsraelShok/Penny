"use client";

import { Switch } from "@/components/ui/switch";
import { usePlan } from "@/hooks/use-plan";
import { Segmented } from "@/components/ui/segmented";
import { HOME_STYLES, type HomeStyle } from "@/lib/plan";
import { useState } from "react";
import { Check, Loader2, Palette } from "lucide-react";

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
        <div role="radiogroup" aria-label={t("languageCardTitle")} className="grid grid-cols-2 gap-2 py-1">
          {langOptions.map((o) => {
            const isActive = (mutation.isPending ? mutation.variables : storedLang) === o.value; // optimistic; reverts on error
            const isPending = mutation.isPending && mutation.variables === o.value;
            const dir = o.value === "he" ? "rtl" : "ltr";
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                lang={o.value}
                dir={dir}
                onClick={() => {
                  if (storedLang === o.value || mutation.isPending) return;
                  mutation.mutate(o.value);
                }}
                disabled={mutation.isPending}
                className={`relative flex min-h-24 flex-col justify-between overflow-hidden rounded-xl border p-3 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70 ${
                  isActive ? "border-primary bg-primary/10" : "border-border/60 hover:border-border hover:bg-muted/40"
                }`}
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="text-lg leading-6 font-semibold">{o.label}</span>
                  <span aria-hidden className={`flex size-5 shrink-0 items-center justify-center rounded-full ${isActive ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                    {isPending ? <Loader2 className="size-3 animate-spin" /> : isActive ? <Check className="size-3.5" /> : null}
                  </span>
                </span>
                <span className={`mt-2 line-clamp-2 text-caption leading-tight ${isActive ? "text-foreground/80" : "text-muted-foreground"}`}>
                  {isPending ? t("languageSaving") : o.description}
                </span>
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
    // Paging moves between pages; in Simple mode there is no scrolling between pages at all.
    { key: "wheelPaging", label: t("wheelPaging"), hint: plan.razeMode ? t("wheelPagingAdvancedOnly") : t("wheelPagingHint") },
  ] as const;
  return (
    <SettingCard title={t("comfortTitle")} description={t("comfortDescription")}>
      <SettingList>
        <SettingRow label={t("homeView")} hint={t("homeViewHint")}>
          <Segmented label={t("homeView")} value={plan.razeMode ? "simple" : "advanced"}
            onChange={(next) => { if (!loaded || (next === "simple") === plan.razeMode) return; void update({ razeMode: next === "simple" }).catch(() => {}); }}
            options={[{ value: "simple", label: t("homeViewSimple") }, { value: "advanced", label: t("homeViewAdvanced") }]} />
        </SettingRow>
        <SettingRow label={t("homeStyle")} hint={t(`homeStyleHint_${homeStyle}`)}>
          <Segmented label={t("homeStyle")} value={homeStyle} onChange={(next) => { if (!loaded || next === homeStyle) return; setPicked(next); update({ homeStyle: next }).catch(() => setPicked(null)); }}
            options={HOME_STYLES.map((s) => ({ value: s, label: t(`homeStyle_${s}`) }))} />
        </SettingRow>
        {rows.map((r) => (
          <SettingRow key={r.key} label={r.label} hint={r.hint} htmlFor={`comfort-${r.key}`}>
            <Switch id={`comfort-${r.key}`} checked={plan[r.key]} disabled={!loaded || (r.key === "wheelPaging" && plan.razeMode)}
              onCheckedChange={(v) => void update({ [r.key]: v }).catch(() => {})} />
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
