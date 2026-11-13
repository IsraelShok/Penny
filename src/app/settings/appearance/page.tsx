"use client";

import { Switch } from "@/components/ui/switch";
import { usePlan } from "@/hooks/use-plan";

import { useRouter } from "next/navigation";
import { StudioEditor } from "@/components/dashboard/studio-editor";
import { studioCopy } from "@/components/dashboard/studio-copy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
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
      <SettingCard title={c.globalSettings} description={c.studioHint}><StudioEditor inline /></SettingCard>

      <SettingCard title={t("languageCardTitle")} description={t("languageCardDescription")}>
        <div className="grid gap-2 sm:grid-cols-2">
          {langOptions.map((o) => {
            const isActive = storedLang === o.value;
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
    </SectionShell>
  );
}

/** Focus settings: fewer moving parts for people who lose their place easily. */
function ComfortCard() {
  const t = useTranslations("settings.appearance");
  const { plan, update, loaded } = usePlan();
  const rows = [
    { key: "simpleMode", label: t("simpleMode"), hint: t("simpleModeHint") },
    { key: "wheelPaging", label: t("wheelPaging"), hint: t("wheelPagingHint") },
  ] as const;
  return (
    <SettingCard title={t("comfortTitle")} description={t("comfortDescription")}>
      <div className="divide-y divide-border">
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
