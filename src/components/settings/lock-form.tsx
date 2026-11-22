"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The one field on the lock screen. A wrong try waits longer each time (the server enforces it). */
export function LockForm({ next }: { next: string }) {
  const t = useTranslations("lock");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-4 text-start"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await fetch("/api/lock/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret }),
        }).catch(() => null);
        if (res?.ok) return window.location.assign(next);
        const body = ((await res?.json().catch(() => ({}))) ?? {}) as { retryAfter?: number };
        setSecret("");
        setError(t(res?.status === 429 ? "wait" : "wrong", { seconds: body.retryAfter ?? 1 }));
        setBusy(false);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="lock-secret">{t("label")}</Label>
        <Input
          id="lock-secret"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "lock-error" : undefined}
          className="h-11"
        />
      </div>
      {error && (
        <p id="lock-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy || !secret}>
        {t("submit")}
      </Button>
    </form>
  );
}
