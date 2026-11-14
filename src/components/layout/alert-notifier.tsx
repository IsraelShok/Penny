"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getSuggestions } from "@/lib/api";
import { readStored } from "@/lib/legacy-names";

const SEEN_KEY = "penny-notified-suggestions";
const LEGACY_SEEN_KEY = "spent-notified-suggestions"; // legacy: spent-notified-suggestions from installs before the Penny rename

/**
 * Shows a desktop notification for each suggestion it hasn't announced before, while the app is open
 * and notifications are allowed. Remembers what it announced in this browser only.
 */
export function AlertNotifier() {
  const t = useTranslations("suggestions");
  const { data } = useQuery({ queryKey: ["suggestions"], queryFn: getSuggestions, refetchInterval: 30 * 60 * 1000 });

  useEffect(() => {
    if (!data || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    let seen: string[] = [];
    try {
      seen = JSON.parse(readStored(SEEN_KEY, LEGACY_SEEN_KEY) ?? "[]");
    } catch {}
    const fresh = data.suggestions.filter((s) => !seen.includes(s.key));
    if (fresh.length === 0) return;
    // One notification, not a burst: the count and where to look.
    new Notification(t("notifyTitle"), { body: t("notifyBody", { count: fresh.length }), tag: "penny-suggestions" });
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ...fresh.map((s) => s.key)].slice(-300)));
    } catch {}
  }, [data, t]);

  return null;
}
