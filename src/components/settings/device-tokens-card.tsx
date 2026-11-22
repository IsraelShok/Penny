"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingCard } from "@/components/settings/section-shell";

interface DeviceToken {
  id: number;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

async function call<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error("failed");
  return res.json() as Promise<T>;
}

/** Device tokens for adding expenses from a phone automation; each token is shown once. */
export function DeviceTokensCard() {
  const t = useTranslations("settings.privacy");
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const tokens = useQuery({
    queryKey: ["device-tokens"],
    queryFn: () => call<{ tokens: DeviceToken[] }>("/api/device-tokens", "GET"),
  });
  const lan = useQuery({
    queryKey: ["lan"],
    queryFn: async (): Promise<{ urls: string[] }> => (await fetch("/api/lan")).json(),
  });
  const create = useMutation({
    mutationFn: () => call<{ token: string }>("/api/device-tokens", "POST", { name }),
    onSuccess: (r) => {
      setFresh(r.token);
      setName("");
      void qc.invalidateQueries({ queryKey: ["device-tokens"] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: number) => call(`/api/device-tokens?id=${id}`, "DELETE"),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["device-tokens"] }),
  });
  const url = `${lan.data?.urls?.[0] ?? "http://<LAN>:3000"}/api/quick-add`;
  const token = fresh ?? "<TOKEN>";

  return (
    <SettingCard title={t("quickAddTitle")} description={t("quickAddDescription")}>
      <div className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <Input
            aria-label={t("quickAddName")}
            placeholder={t("quickAddName")}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            {t("quickAddCreate")}
          </Button>
        </form>
        {create.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("lockError_failed")}
          </p>
        )}
        {fresh && (
          <div className="space-y-1" aria-live="polite">
            <p className="text-sm font-medium">{t("quickAddShownOnce")}</p>
            <code
              dir="ltr"
              className="block select-all break-all rounded bg-muted px-3 py-2 font-mono text-sm"
            >
              {fresh}
            </code>
          </div>
        )}
        {(tokens.data?.tokens ?? []).length > 0 && (
          <ul className="divide-y rounded border">
            {tokens.data!.tokens.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {d.name}
                  <span className="block text-xs text-muted-foreground">
                    {d.lastUsedAt
                      ? t("quickAddLastUsed", { date: d.lastUsedAt.slice(0, 10) })
                      : t("quickAddNeverUsed")}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(d.id)}
                >
                  {t("quickAddRevoke")}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">{t("quickAddIphoneTitle")}</summary>
          <p className="mt-2 whitespace-pre-line text-muted-foreground">
            {t("quickAddIphoneSteps", { url, token })}
          </p>
        </details>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">{t("quickAddAndroidTitle")}</summary>
          <p className="mt-2 whitespace-pre-line text-muted-foreground">
            {t("quickAddAndroidSteps", { url, token })}
          </p>
        </details>
        <p className="text-xs text-muted-foreground">{t("quickAddNote")}</p>
      </div>
    </SettingCard>
  );
}
