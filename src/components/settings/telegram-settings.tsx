"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Forward } from "@/components/ui/dir-chevron";
import { SectionShell, SettingCard } from "@/components/settings/section-shell";

interface Status { connected: boolean; linked: boolean; username: string | null; code: string | null; hideAmounts: boolean }

const call = async (method: string, body?: unknown): Promise<Status> => {
  const res = await fetch("/api/telegram", { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "failed");
  return res.json();
};

/** Connect a Telegram bot the user made with BotFather; linking happens by opening the bot from here. */
export function TelegramSettings() {
  const t = useTranslations("telegram");
  const qc = useQueryClient();
  const [token, setToken] = useState("");
  const status = useQuery({
    queryKey: ["telegram"],
    queryFn: () => call("GET"),
    // Wait for the user to press Start in Telegram.
    refetchInterval: (q) => (q.state.data?.connected && !q.state.data.linked ? 3000 : false),
  });
  const save = useMutation({ mutationFn: () => call("POST", { token }), onSuccess: (d) => { setToken(""); qc.setQueryData(["telegram"], d); } });
  const remove = useMutation({ mutationFn: () => call("DELETE"), onSuccess: (d) => qc.setQueryData(["telegram"], d) });
  const hide = useMutation({ mutationFn: (on: boolean) => call("PATCH", { hideAmounts: on }), onSuccess: (d) => qc.setQueryData(["telegram"], d) });
  const s = status.data;

  return (
    <SectionShell title={t("title")} description={t("description")}>
      {s?.linked ? (
        <SettingCard>
          <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-5 text-status-on-track" aria-hidden />{t("linked", { name: `@${s.username ?? ""}` })}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("linkedHint")}</p>
          <div className="mt-4 flex min-h-11 items-center justify-between gap-4">
            <Label htmlFor="tg-hide" className="flex-1">{t("hideAmounts")}</Label>
            <Switch id="tg-hide" checked={s.hideAmounts} onCheckedChange={(on) => hide.mutate(on)} disabled={hide.isPending} />
          </div>
          <Button variant="outline" className="mt-5" onClick={() => remove.mutate()} disabled={remove.isPending}>{t("disconnect")}</Button>
        </SettingCard>
      ) : s?.connected && s.code ? (
        <SettingCard title={t("step2Title")} description={t("step2Hint")}>
          <a href={`https://t.me/${s.username}?start=${s.code}`} target="_blank" rel="noreferrer" className={buttonVariants({ size: "lg" })}>
            {t("open", { name: `@${s.username}` })}<Forward />
          </a>
          <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">{t("waiting")}</p>
        </SettingCard>
      ) : (
        <SettingCard title={t("step1Title")}>
          <ol className="mb-5 list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
            <li>{t("howBotFather")}</li>
            <li>{t("howNewBot")}</li>
            <li>{t("howCopy")}</li>
          </ol>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-2">
            <Label htmlFor="tg-token">{t("tokenLabel")}</Label>
            <div className="flex gap-2">
              <Input id="tg-token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} className="flex-1" dir="ltr" />
              <Button type="submit" disabled={!token.trim() || save.isPending}>{t("connect")}</Button>
            </div>
            {save.error && <p className="text-sm text-destructive" role="alert">{t(save.error.message === "invalid_token" ? "errorFormat" : "errorRejected")}</p>}
            <p className="text-xs text-muted-foreground">{t("privacy")}</p>
          </form>
        </SettingCard>
      )}
    </SectionShell>
  );
}
