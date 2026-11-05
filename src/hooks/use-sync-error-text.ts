import { useTranslations } from "next-intl";
import { parseSyncError } from "@/lib/sync-errors";

// Turns a stored sync error into the user's language, keeping the raw scraper detail apart.
export function useSyncErrorText() {
  const t = useTranslations("syncErrors");
  return (message: string): { message: string; detail: string | null } => {
    const { key, detail } = parseSyncError(message);
    return key ? { message: t(key), detail: detail || null } : { message, detail: null };
  };
}
