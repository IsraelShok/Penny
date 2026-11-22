"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import qrcode from "qrcode-generator";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SettingCard, SettingRow, StatusChip } from "@/components/settings/section-shell";
import { postLock } from "@/components/settings/app-lock-card";

interface LanStatus {
  enabled: boolean;
  lockEnabled: boolean;
  needsRestart: boolean | null;
  restartable: boolean;
  urls: string[];
  platform: string;
}

/** The phone URL as a QR code, drawn locally as SVG squares. */
function UrlQr({ url, label }: { url: string; label: string }) {
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  const cells: string[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(`M${c + 4},${r + 4}h1v1h-1z`);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${n + 8} ${n + 8}`}
      className="size-40 rounded bg-white"
      shapeRendering="crispEdges"
    >
      <path d={cells.join("")} fill="#000" />
    </svg>
  );
}

/** Phone access on the home network: off by default, needs the app lock, applies on restart. */
export function LanAccessCard() {
  const t = useTranslations("settings.privacy");
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["lan"],
    queryFn: async (): Promise<LanStatus> => (await fetch("/api/lan")).json(),
  });
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
    <SettingCard
      title={t("lanTitle")}
      description={t("lanDescription")}
      aside={s && <StatusChip on={s.enabled} label={s.enabled ? t("statusOn") : t("statusOff")} />}
    >
      <div className="space-y-4">
        <SettingRow
          label={t("lanLabel")}
          htmlFor="lan-access"
          hint={lockOff ? t("lanLockRequired") : undefined}
        >
          <Switch
            id="lan-access"
            checked={s?.enabled ?? false}
            disabled={!s || toggle.isPending || (lockOff && !s?.enabled)}
            onCheckedChange={(v) => toggle.mutate(v)}
          />
        </SettingRow>
        {toggle.error && (
          <p role="alert" className="text-sm text-destructive">
            {t(toggle.error.message === "lock_required" ? "lanLockRequired" : "lockError_failed")}
          </p>
        )}
        {s?.enabled && (
          <>
            <p className="text-sm text-muted-foreground">{t("lanUnencrypted")}</p>
            {s.urls.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm">{t("lanOpenOnPhone")}</p>
                {s.urls[0] && <UrlQr url={s.urls[0]} label={t("lanQr")} />}
                {s.urls.map((u) => (
                  <code
                    key={u}
                    dir="ltr"
                    className="block select-all break-all rounded bg-muted px-3 py-2 font-mono text-lg"
                  >
                    {u}
                  </code>
                ))}
              </div>
            ) : (
              <p className="text-sm">{t("lanNoNetwork")}</p>
            )}
            {s.platform === "win32" && (
              <p className="text-xs text-muted-foreground">{t("lanFirewall")}</p>
            )}
          </>
        )}
        {s && s.needsRestart !== false && (s.enabled || s.needsRestart) && (
          <div className="space-y-2" aria-live="polite">
            <p className="text-sm font-medium">{t("lanRestartNeeded")}</p>
            {s.restartable ? (
              <Button
                type="button"
                variant="outline"
                disabled={restart.isPending || restart.isSuccess}
                onClick={() => restart.mutate()}
              >
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
