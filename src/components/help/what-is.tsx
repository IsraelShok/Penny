"use client";

import { useTranslations } from "next-intl";
import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Concept } from "@/lib/orientation";
import { cn } from "@/lib/utils";

/** "What is this?" button: a short plain explanation of one concept. Tab to it, Enter opens, Esc closes. */
export function WhatIs({ concept, className }: { concept: Concept; className?: string }) {
  const t = useTranslations("concepts");
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("whatIs", { term: t(`${concept}.term`) })}
        className={cn(
          "-my-3 inline-grid size-11 place-items-center rounded-full align-middle hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className,
        )}
      >
        <CircleHelp className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="text-start">
        <p className="font-semibold">{t(`${concept}.term`)}</p>
        <p className="mt-1 text-footnote">{t(`${concept}.body`)}</p>
      </PopoverContent>
    </Popover>
  );
}
