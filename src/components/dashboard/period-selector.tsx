"use client";

import { useTranslations } from "next-intl";
import { Back, Forward } from "@/components/ui/dir-chevron";
import { Button } from "@/components/ui/button";

interface PeriodSelectorProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}

export function PeriodSelector({ label, onPrev, onNext }: PeriodSelectorProps) {
  const t = useTranslations("nav");
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-card px-1">
      <Button variant="ghost" size="icon-sm" onClick={onPrev} aria-label={t("prevMonth")}>
        <Back />
      </Button>
      <span className="min-w-0 sm:min-w-[120px] text-center text-sm font-medium tabular-nums">
        {label}
      </span>
      <Button variant="ghost" size="icon-sm" onClick={onNext} aria-label={t("nextMonth")}>
        <Forward />
      </Button>
    </div>
  );
}
