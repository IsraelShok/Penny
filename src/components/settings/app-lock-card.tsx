"use client";

import { useState } from "react";
import { passkeySupport, registerPasskey } from "@/lib/passkey-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import {
  SettingCard,
  SettingList,
  SettingRow,
  StatusChip,
} from "@/components/settings/section-shell";

export interface LockStatus {
  enabled: boolean;
  idleMinutes: number;
  passkeys?: { id: string; rpID: string; createdAt: number }[];
}

export const getLockStatus = async (): Promise<LockStatus> => (await fetch("/api/lock")).json();

/** Posts to a lock API; throws the error code ("wrong", "wait", "weak") for the message. */
export async function postLock(url: string, body: unknown): Promise<{ recoveryCode?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; recoveryCode?: string };
  if (!res.ok) throw new Error(json.error ?? "failed");
  return json;
}

const ERRORS = ["wrong", "wait", "weak", "no_prf", "cancelled", "passkey_failed"];

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

  const [recovery, setRecovery] = useState<string | null>(null);
  const support =
    useQuery({ queryKey: ["passkey-support"], queryFn: passkeySupport, staleTime: Infinity })
      .data ?? "unsupported";
  const done = (res?: { recoveryCode?: string }) => {
    setCurrent("");
    setSecret("");
    setRecovery(res?.recoveryCode ?? null);
    void qc.invalidateQueries({ queryKey: ["lock"] });
  };
  const run = useMutation({
    mutationFn: (action: "enable" | "change" | "disable" | "recovery") =>
      postLock("/api/lock", { action, current, secret, idleMinutes: minutes }),
    onSuccess: done,
  });
  const passkey = useMutation({
    mutationFn: (id?: string) =>
      id
        ? postLock("/api/lock", { action: "passkey-remove", id }).then(() => {})
        : registerPasskey(current),
    onSuccess: () => done(),
  });
  const busy = run.isPending || passkey.isPending;
  // A browser that dismisses the prompt throws NotAllowedError; show it as "cancelled".
  const raw =
    run.error?.message ??
    (passkey.error &&
      (passkey.error.name === "NotAllowedError" ? "cancelled" : passkey.error.message));
  const error = raw ?? undefined;
  const passkeys = status.data?.passkeys ?? [];

  return (
    <SettingCard
      title={t("lockTitle")}
      description={t("lockDescription")}
      aside={
        status.data && <StatusChip on={enabled} label={enabled ? t("statusOn") : t("statusOff")} />
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run.mutate(enabled ? "change" : "enable");
        }}
      >
        <p className="sr-only" aria-live="polite">
          {enabled ? t("lockOn") : t("lockOff")}
        </p>
        <SettingList>
          {enabled && (
            <SettingRow label={t("lockCurrent")} htmlFor="lock-current">
              <Input
                id="lock-current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="h-11 w-full sm:w-56"
              />
            </SettingRow>
          )}
          <SettingRow
            label={enabled ? t("lockNew") : t("lockSecret")}
            htmlFor="lock-secret"
            hint={<span id="lock-hint">{t("lockHint")}</span>}
          >
            <Input
              id="lock-secret"
              type="password"
              autoComplete="new-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="h-11 w-full sm:w-56"
              aria-describedby="lock-hint"
            />
          </SettingRow>
          <SettingRow label={t("lockIdle")}>
            <Segmented
              label={t("lockIdle")}
              value={minutes}
              onChange={setIdle}
              options={IDLE.map((m) => ({ value: m, label: t("lockMinutes", { count: m }) }))}
            />
          </SettingRow>
        </SettingList>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t(ERRORS.includes(error) ? `lockError_${error}` : "lockError_failed")}
          </p>
        )}
        {recovery && (
          <div role="status" className="space-y-2 rounded-xl bg-muted p-4">
            <p className="text-sm font-medium">{t("recoveryShown")}</p>
            <p
              dir="ltr"
              className="font-mono text-base tracking-wider select-all"
              data-testid="recovery-code"
            >
              {recovery}
            </p>
            <p className="text-sm text-muted-foreground">{t("recoveryHint")}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || (enabled ? !current : !secret)}>
            {enabled ? t("lockSave") : t("lockEnable")}
          </Button>
          {enabled && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || !current}
              onClick={() => run.mutate("disable")}
            >
              {t("lockDisable")}
            </Button>
          )}
          {enabled && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || !current}
              onClick={() => run.mutate("recovery")}
            >
              {t("recoveryNew")}
            </Button>
          )}
        </div>
        {enabled && (
          <SettingList>
            <SettingRow
              label={t("passkeyTitle")}
              hint={support === "ok" ? t("passkeyHint") : t(`passkeyUnavailable_${support}`)}
            >
              {support === "ok" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !current}
                  onClick={() => passkey.mutate(undefined)}
                >
                  {t("passkeyAdd")}
                </Button>
              )}
            </SettingRow>
            {passkeys.map((p, i) => (
              <SettingRow
                key={p.id}
                label={t("passkeyItem", { n: i + 1, host: p.rpID })}
                hint={new Date(p.createdAt).toLocaleDateString()}
              >
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => passkey.mutate(p.id)}
                >
                  {t("passkeyRemove")}
                </Button>
              </SettingRow>
            ))}
          </SettingList>
        )}
      </form>
    </SettingCard>
  );
}
