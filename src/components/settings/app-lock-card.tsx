"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { SettingCard, SettingList, SettingRow, StatusChip } from "@/components/settings/section-shell";

export interface LockStatus { enabled: boolean; idleMinutes: number }

export const getLockStatus = async (): Promise<LockStatus> => (await fetch("/api/lock")).json();

/** Posts to a lock API; throws the error code ("wrong", "wait", "weak") for the message. */
export async function postLock(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "failed");
}

const IDLE = [5, 15, 60];

export function AppLockCard() {
  const t = useTranslations("settings.privacy");
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["lock"], queryFn: getLockStatus });
  const [current, setCurrent] = useState("");
  const [secret, setSecret] = useState("");
  const [idle, setIdle] = useState<number | null>(null);
  const enabled = status.data?.enabled ?? false;
  const minutes = idle ?? status.data?.idleMinutes ?? 15;

  const run = useMutation({
    mutationFn: (action: "enable" | "change" | "disable") => postLock("/api/lock", { action, current, secret, idleMinutes: minutes }),
    onSuccess: () => {
      setCurrent("");
      setSecret("");
      void qc.invalidateQueries({ queryKey: ["lock"] });
    },
  });
  const error = run.error?.message;

  return (
    <SettingCard title={t("lockTitle")} description={t("lockDescription")} aside={status.data && <StatusChip on={enabled} label={enabled ? t("statusOn") : t("statusOff")} />}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run.mutate(enabled ? "change" : "enable");
        }}
      >
        <p className="sr-only" aria-live="polite">{enabled ? t("lockOn") : t("lockOff")}</p>
        <SettingList>
          {enabled && (
            <SettingRow label={t("lockCurrent")} htmlFor="lock-current">
              <Input id="lock-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="h-11 w-full sm:w-56" />
            </SettingRow>
          )}
          <SettingRow label={enabled ? t("lockNew") : t("lockSecret")} htmlFor="lock-secret" hint={<span id="lock-hint">{t("lockHint")}</span>}>
            <Input id="lock-secret" type="password" autoComplete="new-password" value={secret} onChange={(e) => setSecret(e.target.value)} className="h-11 w-full sm:w-56" aria-describedby="lock-hint" />
          </SettingRow>
          <SettingRow label={t("lockIdle")}>
            <Segmented label={t("lockIdle")} value={minutes} onChange={setIdle} options={IDLE.map((m) => ({ value: m, label: t("lockMinutes", { count: m }) }))} />
          </SettingRow>
        </SettingList>
        {error && <p role="alert" className="text-sm text-destructive">{t(error === "wrong" || error === "wait" || error === "weak" ? `lockError_${error}` : "lockError_failed")}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={run.isPending || (enabled ? !current : !secret)}>{enabled ? t("lockSave") : t("lockEnable")}</Button>
          {enabled && (
            <Button type="button" variant="outline" disabled={run.isPending || !current} onClick={() => run.mutate("disable")}>{t("lockDisable")}</Button>
          )}
        </div>
      </form>
    </SettingCard>
  );
}
