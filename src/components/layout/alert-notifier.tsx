"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getSuggestions } from "@/lib/api";

const SEEN_KEY = "penny-notified-suggestions";

/**
 * Shows a desktop notification for each suggestion it hasn't announced before, while the app is open
 * and notifications are allowed. Remembers what it announced in this browser only.
 */
export function AlertNotifier() {
  const t = useTranslations("suggestions");
  const { data } = useQuery({
    queryKey: ["suggestions"],
    queryFn: getSuggestions,
    refetchInterval: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (!data || typeof Notification === "undefined" || Notification.permission !== "granted")
      return;
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    } catch {
      // Storage is blocked or full: only a remembered preference is lost.
    }
    const fresh = data.suggestions.filter((s) => !seen.includes(s.key));
    if (fresh.length === 0) return;
    // One notification, not a burst: the count and where to look.
    new Notification(t("notifyTitle"), {
      body: t("notifyBody", { count: fresh.length }),
      tag: "penny-suggestions",
    });
    try {
      localStorage.setItem(
        SEEN_KEY,
        JSON.stringify([...seen, ...fresh.map((s) => s.key)].slice(-300)),
      );
    } catch {
      // Storage is blocked or full: only a remembered preference is lost.
    }
  }, [data, t]);

  return null;
}
