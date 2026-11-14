import { useLocale, useTranslations } from "next-intl";
import { parseSyncError } from "@/lib/sync-errors";

// Turns a stored sync error into the user's language, keeping the raw scraper detail apart.
export function useSyncErrorText() {
  const t = useTranslations("syncErrors");
  const locale = useLocale();
  return (message: string): { message: string; detail: string | null } => {
    const { key, detail } = parseSyncError(message);
    if (key) return { message: t(key), detail: detail || null };
    // Unmapped scraper text is English; in Hebrew show a generic line and keep the raw text as detail.
    if (locale === "he" && !/[֐-׿]/.test(message)) return { message: t("unknown"), detail: message || null };
    return { message, detail: null };
  };
}
