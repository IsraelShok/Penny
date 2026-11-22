"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingCard } from "@/components/settings/section-shell";
import { getLockStatus, postLock } from "@/components/settings/app-lock-card";

/** Deletes everything and returns to first run. The word must be typed exactly. */
export function WipeCard() {
  const t = useTranslations("settings.privacy");
  // Matches the server (api/data/wipe), which accepts either word.
  const WORD = useLocale() === "he" ? "מחיקה" : "delete";
  const lock = useQuery({ queryKey: ["lock"], queryFn: getLockStatus });
  const [confirm, setConfirm] = useState("");
  const [secret, setSecret] = useState("");
  const locked = lock.data?.enabled ?? false;
  const wipe = useMutation({
    mutationFn: () => postLock("/api/data/wipe", { confirm: confirm.trim(), secret }),
    // A full reload, so no cached data survives in the page.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full reload
    onSuccess: () => window.location.assign("/"),
  });
  const error = wipe.error?.message;

  return (
    <SettingCard title={t("wipeTitle")} description={t("wipeDescription")}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          wipe.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="wipe-confirm">{t("wipeConfirm", { word: WORD })}</Label>
          <Input
            id="wipe-confirm"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-11"
          />
        </div>
        {locked && (
          <div className="space-y-2">
            <Label htmlFor="wipe-secret">{t("lockCurrent")}</Label>
            <Input
              id="wipe-secret"
              type="password"
              autoComplete="current-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="h-11"
            />
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t(error === "wrong" || error === "wait" ? `lockError_${error}` : "lockError_failed")}
          </p>
        )}
        <Button
          type="submit"
          variant="destructive"
          disabled={wipe.isPending || confirm.trim().toLowerCase() !== WORD || (locked && !secret)}
        >
          {t("wipeCta")}
        </Button>
      </form>
    </SettingCard>
  );
}
