"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getSuggestions } from "@/lib/api";
import { Segmented } from "@/components/ui/segmented";
import { DailyTip } from "@/components/tips/tips";
import { CardShell } from "./card-shell";
import { NotifyToggle, SuggestionsCard } from "./suggestions-card";

/** Home's one card for "worth a look" findings and the tip of the day, as two tabs. With no findings it is just the tip. */
export function SuggestionsTipsCard() {
  const t = useTranslations("suggestions");
  const { data } = useQuery({ queryKey: ["suggestions"], queryFn: getSuggestions });
  const [tab, setTab] = useState<"suggestions" | "tip">("suggestions");
  if (!data?.suggestions.length) return <div className="mb-6 md:mb-8"><DailyTip /></div>;
  return (
    <CardShell className="mb-6 h-auto md:mb-8">
      <div className="mb-4 flex min-h-11 items-center justify-between gap-2">
        <Segmented
          variant="track"
          label={t("tabsLabel")}
          value={tab}
          onChange={setTab}
          options={[{ value: "suggestions", label: t("title") }, { value: "tip", label: t("tipTab") }]}
        />
        {tab === "suggestions" && <NotifyToggle />}
      </div>
      {tab === "suggestions" ? <SuggestionsCard bare limit={3} href="/more#suggestions" /> : <DailyTip bare />}
    </CardShell>
  );
}
