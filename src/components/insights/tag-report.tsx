"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTagReport } from "@/lib/api";
import { shekels } from "@/lib/money";
import { translateCategoryName } from "@/lib/i18n-data";
import { cn } from "@/lib/utils";

/** Tags/events report: total, count and dates per tag; picking one tells where the money went. */
export function TagReport() {
  const t = useTranslations("tags");
  const tCat = useTranslations("categoriesSeeded");
  const locale = useLocale();
  const [selected, setSelected] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["tags"], queryFn: () => getTagReport() });
  const detail = useQuery({
    queryKey: ["tags", selected],
    queryFn: () => getTagReport(selected!),
    enabled: selected != null,
  });
  const money = (n: number) => shekels(Math.round(n), locale);
  const catName = (c: string | null) => (c ? translateCategoryName(c, tCat) : t("uncategorized"));
  const tags = list.data?.tags ?? [];
  if (tags.length === 0) return null;
  const current = tags.find((x) => x.tag === selected);
  const top = detail.data?.breakdown[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("reportTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="grid gap-1">
          {tags.map((x) => (
            <li key={x.tag}>
              <button
                type="button"
                aria-pressed={selected === x.tag}
                onClick={() => setSelected(selected === x.tag ? null : x.tag)}
                className={cn(
                  "flex w-full flex-wrap items-baseline justify-between gap-x-4 rounded-lg px-2 py-2 text-start hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring",
                  selected === x.tag && "bg-muted",
                )}
              >
                <span className="font-medium">#{x.tag}</span>
                <span className="text-lg font-semibold tabular-nums">{money(x.total)}</span>
                <span className="w-full text-xs tabular-nums text-muted-foreground">
                  {t("reportMeta", { count: x.count })} ·{" "}
                  <span dir="ltr">
                    {x.from.slice(0, 10)} – {x.to.slice(0, 10)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {current && detail.data && (
          <div className="grid gap-2 rounded-xl bg-muted/40 p-3">
            <p className="leading-relaxed">
              {top && top.total > 0
                ? t("reportSentence", {
                    tag: current.tag,
                    total: money(current.total),
                    category: catName(top.category),
                  })
                : t("reportSentenceShort", { tag: current.tag, total: money(current.total) })}
            </p>
            <ul className="grid gap-1 text-sm">
              {detail.data.breakdown.map((b) => (
                <li key={b.category ?? ""} className="flex justify-between gap-4">
                  <span>{catName(b.category)}</span>
                  <span className="tabular-nums">{money(b.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
