"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { SettingCard, SettingRow, StatusChip } from "@/components/settings/section-shell";
import { fetchJSON } from "@/lib/api";

/** Settings > Privacy: whether Penny asks GitHub for a newer version (and the Windows app updates itself). */
export function UpdateCheckCard() {
  const t = useTranslations("settings.privacy");
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["update"],
    queryFn: () => fetchJSON<{ enabled: boolean }>("/api/update"),
  });
  const save = useMutation({
    mutationFn: (enabled: boolean) =>
      fetchJSON<{ enabled: boolean }>("/api/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["update"] }),
  });
  const on = q.data?.enabled ?? true;
  return (
    <SettingCard
      title={t("updateCheckTitle")}
      description={t("updateCheckDescription")}
      aside={<StatusChip on={on} label={on ? t("statusOn") : t("statusOff")} />}
    >
      <SettingRow label={t("updateCheckLabel")} htmlFor="update-check">
        <Switch
          id="update-check"
          checked={on}
          disabled={q.isLoading || save.isPending}
          onCheckedChange={(v) => save.mutate(v)}
        />
      </SettingRow>
    </SettingCard>
  );
}
