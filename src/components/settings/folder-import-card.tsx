"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getFolderImport, updateFolderImport, type FolderImportConfig } from "@/lib/api";
import { SettingCard } from "@/components/settings/section-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** Auto-import from a folder: toggle, folder, account name, interval, scan now and recent history. */
export function FolderImportCard() {
  const t = useTranslations("fileImport.folder");
  const queryClient = useQueryClient();
  // shortcut: new-transactions toast only while this page is open (polls every minute); a global notifier would need app-shell wiring.
  const { data } = useQuery({
    queryKey: ["folder-import"],
    queryFn: getFolderImport,
    refetchInterval: 60_000,
  });
  const [dir, setDir] = useState<string | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<string | null>(null);
  const lastTotal = useRef<number | null>(null);

  useEffect(() => {
    if (!data) return;
    if (lastTotal.current != null && data.totalAdded > lastTotal.current) {
      toast.success(t("arrived", { count: data.totalAdded - lastTotal.current }));
      for (const key of ["transactions", "summary", "home"])
        void queryClient.invalidateQueries({ queryKey: [key] });
    }
    lastTotal.current = data.totalAdded;
  }, [data, t, queryClient]);

  const mutate = useMutation({
    mutationFn: updateFolderImport,
    onSuccess: (c: FolderImportConfig) => queryClient.setQueryData(["folder-import"], c),
    onError: (e) =>
      toast.error(
        e instanceof Error && e.message === "notAbsolute" ? t("notAbsolute") : t("failed"),
      ),
  });

  if (!data) return null;
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : t("never"));

  return (
    <SettingCard title={t("title")} description={t("description")}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="folder-import-toggle">{t("enable")}</Label>
          <Switch
            id="folder-import-toggle"
            checked={data.enabled}
            onCheckedChange={(v) => mutate.mutate({ enabled: v })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="folder-import-dir">{t("dir")}</Label>
          <div className="flex gap-2">
            <Input
              id="folder-import-dir"
              dir="ltr"
              value={dir ?? data.dir}
              onChange={(e) => setDir(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={dir == null || dir === data.dir}
              onClick={() => mutate.mutate({ dir: dir! }, { onSuccess: () => setDir(null) })}
            >
              {t("saveDir")}
            </Button>
          </div>
          <p className="text-caption text-muted-foreground">{t("dirHint")}</p>
          {data.dir !== data.defaultDir && (
            <Button
              variant="link"
              className="h-auto p-0 text-caption"
              onClick={() => mutate.mutate({ dir: data.defaultDir })}
            >
              {t("resetDir")}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="folder-import-account">{t("account")}</Label>
            <Input
              id="folder-import-account"
              maxLength={40}
              value={account ?? data.account}
              onChange={(e) => setAccount(e.target.value)}
              onBlur={() =>
                account != null &&
                account !== data.account &&
                mutate.mutate({ account }, { onSuccess: () => setAccount(null) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="folder-import-minutes">{t("minutes")}</Label>
            <Input
              id="folder-import-minutes"
              type="number"
              min={1}
              max={60}
              value={minutes ?? String(data.minutes)}
              onChange={(e) => setMinutes(e.target.value)}
              onBlur={() =>
                minutes != null &&
                mutate.mutate({ minutes: Number(minutes) }, { onSuccess: () => setMinutes(null) })
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={mutate.isPending} onClick={() => mutate.mutate({ action: "scan" })}>
            {t("scanNow")}
          </Button>
          <Button variant="outline" onClick={() => mutate.mutate({ action: "open" })}>
            {t("open")}
          </Button>
        </div>

        <p className="text-footnote text-muted-foreground" aria-live="polite">
          {data.status === "locked"
            ? t("locked")
            : data.status === "error"
              ? t("error", { error: data.error ?? "" })
              : t("lastScan", { when: when(data.lastScanAt), total: data.totalAdded })}
        </p>

        {data.history.length > 0 && (
          <ul className="space-y-1 text-footnote">
            {data.history.slice(0, 5).map((h, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate" dir="ltr">
                  {h.file}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {h.error
                    ? t("historyFailed", { error: h.error })
                    : t("historyOk", { added: h.added, duplicates: h.duplicates })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingCard>
  );
}
