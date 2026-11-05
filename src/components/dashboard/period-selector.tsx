"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface PeriodSelectorProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}

export function PeriodSelector({ label, onPrev, onNext }: PeriodSelectorProps) {
  const t = useTranslations("nav");
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-input bg-background px-1">
      <Button variant="ghost" size="icon-sm" onClick={onPrev} aria-label={t("prevMonth")}>
        <svg
          aria-hidden
          className="h-3.5 w-3.5 rtl:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </Button>
      <span className="min-w-[120px] text-center text-sm font-medium tabular-nums">
        {label}
      </span>
      <Button variant="ghost" size="icon-sm" onClick={onNext} aria-label={t("nextMonth")}>
        <svg
          aria-hidden
          className="h-3.5 w-3.5 rtl:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </Button>
    </div>
  );
}
