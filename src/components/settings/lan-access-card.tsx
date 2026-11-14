"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingCard, StatusChip } from "@/components/settings/section-shell";
import { postLock } from "@/components/settings/app-lock-card";

interface LanStatus {
  enabled: boolean;
  lockEnabled: boolean;
  needsRestart: boolean | null;
  restartable: boolean;
  urls: string[];
  platform: string;
}

/** Phone access on the home network: off by default, needs the app lock, applies on restart. */
export function LanAccessCard() {
  const t = useTranslations("settings.privacy");
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["lan"], queryFn: async (): Promise<LanStatus> => (await fetch("/api/lan")).json() });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => postLock("/api/lan", { enabled }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["lan"] }),
  });
  const restart = useMutation({
    mutationFn: () => postLock("/api/lan", { action: "restart" }),
    onSuccess: () => setTimeout(() => window.location.reload(), 4000),
  });
  const s = status.data;
  const lockOff = s ? !s.lockEnabled : true;

  return (
    <SettingCard title={t("lanTitle")} description={t("lanDescription")} aside={s && <StatusChip on={s.enabled} label={s.enabled ? t("statusOn") : t("statusOff")} />}>
      <div className="space-y-4">
        <div className="flex min-h-11 items-center justify-between gap-4">
          <Label htmlFor="lan-access" className="flex-1">{t("lanLabel")}</Label>
          <Switch id="lan-access" checked={s?.enabled ?? false} disabled={!s || toggle.isPending || (lockOff && !s?.enabled)} onCheckedChange={(v) => toggle.mutate(v)} />
        </div>
        {lockOff && <p className="text-sm text-muted-foreground">{t("lanLockRequired")}</p>}
        {toggle.error && <p role="alert" className="text-sm text-destructive">{t(toggle.error.message === "lock_required" ? "lanLockRequired" : "lockError_failed")}</p>}
        {s?.enabled && (
          <>
            <p className="text-sm text-muted-foreground">{t("lanUnencrypted")}</p>
            {s.urls.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm">{t("lanOpenOnPhone")}</p>
                {s.urls.map((u) => (
                  <code key={u} dir="ltr" className="block select-all break-all rounded bg-muted px-3 py-2 font-mono text-lg">{u}</code>
                ))}
              </div>
            ) : (
              <p className="text-sm">{t("lanNoNetwork")}</p>
            )}
            {s.platform === "win32" && <p className="text-xs text-muted-foreground">{t("lanFirewall")}</p>}
          </>
        )}
        {s && s.needsRestart !== false && (s.enabled || s.needsRestart) && (
          <div className="space-y-2" aria-live="polite">
            <p className="text-sm font-medium">{t("lanRestartNeeded")}</p>
            {s.restartable ? (
              <Button type="button" variant="outline" disabled={restart.isPending || restart.isSuccess} onClick={() => restart.mutate()}>
                {restart.isSuccess ? t("lanRestarting") : t("lanRestart")}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">{t("lanRestartManual")}</p>
            )}
          </div>
        )}
      </div>
    </SettingCard>
  );
}
