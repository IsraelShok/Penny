"use client";

import { useTranslations } from "next-intl";
import type { FormatLastSyncLabels } from "./formatters";

type TranslatorFn = ReturnType<typeof useTranslations<string>>;

export function translateCategoryName(
  rawName: string,
  tCat: TranslatorFn,
): string {
  try {
    const translated = tCat(rawName);
    return translated && translated !== rawName ? translated : rawName;
  } catch {
    return rawName;
  }
}

export function translateProviderName(
  providerId: string,
  fallback: string,
  tBanks: TranslatorFn,
): string {
  try {
    const key = `${providerId}.name`;
    const translated = tBanks(key);
    return translated && translated !== key ? translated : fallback;
  } catch {
    return fallback;
  }
}

export function translateProviderBlurb(
  providerId: string,
  fallback: string,
  tBanks: TranslatorFn,
): string {
  try {
    const key = `${providerId}.blurb`;
    const translated = tBanks(key);
    return translated && translated !== key ? translated : fallback;
  } catch {
    return fallback;
  }
}

/** Localized label/placeholder/hint for a scraper credential field, falling back to the raw English. */
export function translateCredentialField(
  providerId: string,
  field: { key: string; label: string; placeholder?: string; hint?: string },
  tBanks: TranslatorFn,
): { label: string; placeholder?: string; hint?: string } {
  const base =
    field.key === "password" && providerId === "isracard" ? "isracardPassword"
    : field.key === "password" && providerId === "oneZero" ? "oneZeroPassword"
    : field.key;
  const tr = (prop: string, fallback?: string) => {
    if (fallback === undefined) return undefined;
    const key = `fields.${base}.${prop}`;
    return tBanks.has(key) ? tBanks(key) : fallback;
  };
  return {
    label: tr("label", field.label)!,
    placeholder: tr(field.key === "num" ? `${providerId}Placeholder` : "placeholder", field.placeholder),
    hint: tr("hint", field.hint),
  };
}

export function useFormatterLabels(): FormatLastSyncLabels {
  const t = useTranslations("formatters");
  return {
    never: t("neverSynced"),
    justNow: t("justNow"),
    minute: (n) => t("minutesAgoShort", { count: n }),
    hour: (n) => t("hoursAgoShort", { count: n }),
    day: (n) => t("daysAgoShort", { count: n }),
    week: (n) => t("weeksAgoShort", { count: n }),
    monthAgo: (n) => t("monthsAgoShort", { count: n }),
  };
}
