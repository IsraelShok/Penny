"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getTagReport } from "@/lib/api";
import { OverviewView } from "./overview-view";
import { InsightsView } from "@/components/insights/insights-view";
import { TagReport } from "@/components/insights/tag-report";

const TABS = ["period", "ahead", "recurring", "tags"] as const;
type Tab = (typeof TABS)[number];
const KEY = "overview-tab";

/** Overview + insights on one page, one tab at a time. The tab lives in ?tab= so links and back work. */
export function OverviewTabs() {
  const t = useTranslations("overview");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tags = useQuery({ queryKey: ["tags"], queryFn: () => getTagReport() });
  const hasTags = (tags.data?.tags.length ?? 0) > 0;
  const fromUrl = params.get("tab") as Tab | null;
  const wanted: Tab = fromUrl && TABS.includes(fromUrl) ? fromUrl : "period";
  // Tags tab without tags (yet, or at all) falls back to the period.
  const tab: Tab = wanted === "tags" && !hasTags ? "period" : wanted;

  const go = (next: Tab, replace = false) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage is blocked or full: only a remembered preference is lost.
    }
    const url = `${pathname}?tab=${next}`;
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  };

  // No ?tab: come back to the tab you last looked at.
  useEffect(() => {
    if (fromUrl) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      // Storage is blocked or full: only a remembered preference is lost.
    }
    if (saved && saved !== "period" && TABS.includes(saved as Tab))
      router.replace(`${pathname}?tab=${saved}`, { scroll: false });
  }, [fromUrl, pathname, router]);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* The view tabs live in the Budget area's tab row; only the rare tag report gets a link here. */}
      {hasTags && tab !== "tags" && (
        <button
          type="button"
          onClick={() => go("tags")}
          className="print-hidden min-h-11 text-footnote font-medium text-primary"
        >
          {t("tab_tags")}
        </button>
      )}
      <div role="region" aria-label={t(`tab_${tab}`)}>
        {tab === "period" && <OverviewView />}
        {tab === "ahead" && <InsightsView part="ahead" />}
        {tab === "recurring" && <InsightsView part="recurring" />}
        {tab === "tags" && <TagReport />}
      </div>
    </div>
  );
}
