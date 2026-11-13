"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getHome } from "@/lib/api";
import { formatLastSync } from "@/lib/formatters";
import { useFormatterLabels } from "@/lib/i18n-data";
import { CommandPalette, OPEN_COMMAND_PALETTE } from "./command-palette";

const NUDGED_KEY = "penny-stale-nudged";

/**
 * Floating search, opened from the sidebar's Search button, "/" or Ctrl/⌘K; closes with Esc or a click outside.
 * Also owns the once-per-session "your data is out of date" nudge.
 */
export function BottomBar() {
  const t = useTranslations("nav");
  const router = useRouter();
  const labels = useFormatterLabels();
  const [shown, setShown] = useState(false);
  const hide = useCallback(() => setShown(false), []);
  const home = useQuery({ queryKey: ["home"], queryFn: getHome });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setShown(true);
      }
    }
    const open = () => setShown(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_PALETTE, open);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_PALETTE, open);
    };
  }, []);

  // Once per browser session: if any bank is stale, failed or never synced, suggest updating.
  const health = home.data?.bankHealth;
  useEffect(() => {
    if (!health?.length) return;
    try { if (sessionStorage.getItem(NUDGED_KEY)) return; sessionStorage.setItem(NUDGED_KEY, "1"); } catch {}
    const bad = health.find((h) => h.status === "error") ?? health.find((h) => h.status === "never") ?? health.find((h) => h.status === "stale");
    if (!bad) return;
    const description = bad.status === "error" ? t("staleError") : bad.status === "never" || !bad.lastSyncAt ? t("staleNever") : t("staleBody", { when: formatLastSync(bad.lastSyncAt, labels) });
    toast(t("staleTitle"), { description, duration: 15000, action: { label: t("updateNow"), onClick: () => router.push("/settings/bank?sync=1") } });
  }, [health, labels, router, t]);

  if (!shown) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6">
      <div data-search-root className="glass pointer-events-auto relative flex w-full max-w-2xl items-center gap-1 rounded-full border border-border p-1.5 shadow-2xl">
        <CommandPalette placeholder={t("askBar")} onClose={hide} />
      </div>
    </div>
  );
}
