"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Longer explanations stay out of the way: a small "i" that opens the text on click, tap or Enter. */
export function InfoTip({ text, className }: { text: string; className?: string }) {
  const t = useTranslations("common");
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("moreInfo")}
        className={cn("inline-grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring", className)}
      >
        <Info className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-sm leading-relaxed">{text}</PopoverContent>
    </Popover>
  );
}
