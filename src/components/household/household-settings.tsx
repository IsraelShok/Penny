"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionShell, SettingCard } from "@/components/settings/section-shell";
import { useHousehold } from "@/hooks/use-household";
import {
  INCOME_SHAPES,
  LIFE_EVENTS,
  MEMBER_ROLES,
  MONEY_STYLES,
  newId,
  shouldSuggestGentle,
  type IncomeShape,
  type LifeEventType,
  type MemberRole,
  type MoneyStyle,
} from "@/lib/household";

export function HouseholdSettings() {
  const t = useTranslations("household");
  const tCommon = useTranslations("common");
  const tJ = useTranslations("journey");
  const { household, loading } = useHousehold();

  return (
    <SectionShell title={t("title")} description={t("description")}>
      {loading ? (
        <SettingCard>
          <div className="text-sm text-muted-foreground">{tCommon("loading")}</div>
        </SettingCard>
      ) : (
        <>
          {shouldSuggestGentle(household) && <GentleSuggestion />}
          <MembersCard />
          <MoneyShapeCard />
          <GentleModeCard />
          <LifeEventsCard />
          <Link href="/journey" className="block text-subheadline text-primary hover:underline">{tJ("settingsLink")}</Link>
        </>
      )}
    </SectionShell>
  );
}

function GentleSuggestion() {
  const t = useTranslations("household");
  const { save } = useHousehold();
  return (
    <div role="status" className="rounded-2xl border border-border bg-muted/40 p-5">
      <p className="text-sm">{t("gentleSuggestion")}</p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => save({ gentleMode: true, gentleSuggestionDismissed: true })}>
          {t("gentleTurnOn")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => save({ gentleSuggestionDismissed: true })}>
          {t("gentleNoThanks")}
        </Button>
      </div>
    </div>
  );
}

function MembersCard() {
  const t = useTranslations("household");
  const tCommon = useTranslations("common");
  const { household, save, saving } = useHousehold();
  const [name, setName] = useState("");
  const [role, setRole] = useState<MemberRole>("me");
  const [birthYear, setBirthYear] = useState("");

  const year = birthYear.trim() === "" ? null : Number(birthYear);
  const valid =
    name.trim() !== "" &&
    (year == null || (Number.isInteger(year) && year > 1900 && year <= new Date().getFullYear()));

  function add() {
    save({ members: [...household.members, { id: newId(), name: name.trim(), role, birthYear: year }] });
    setName("");
    setBirthYear("");
  }

  return (
    <SettingCard title={t("membersTitle")} description={t("membersDescription")}>
      {household.members.length > 0 && (
        <ul className="mb-4 divide-y divide-border">
          {household.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {t(`role.${m.role}`)}
                  {m.birthYear ? ` · ${m.birthYear}` : ""}
                </span>
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("removeItem", { name: m.name })}
                onClick={() => save({ members: household.members.filter((x) => x.id !== m.id) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_120px_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="member-name">{t("memberName")}</Label>
          <Input id="member-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="member-role">{t("memberRole")}</Label>
          <Select value={role} onValueChange={(v) => v && setRole(v as MemberRole)}>
            <SelectTrigger id="member-role">
              <SelectValue>{t(`role.${role}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MEMBER_ROLES.map((r) => (
                <SelectItem key={r} value={r}>{t(`role.${r}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="member-year">{t("birthYear")}</Label>
          <Input
            id="member-year"
            type="number"
            inputMode="numeric"
            className="tabular-nums"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
          />
        </div>
        <Button onClick={add} disabled={!valid || saving}>{tCommon("add")}</Button>
      </div>
    </SettingCard>
  );
}

function MoneyShapeCard() {
  const t = useTranslations("household");
  const { household, save } = useHousehold();
  return (
    <SettingCard title={t("moneyTitle")} description={t("moneyDescription")}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="income-shape">{t("incomeShape")}</Label>
          <Select
            value={household.incomeShape ?? ""}
            onValueChange={(v) => v && save({ incomeShape: v as IncomeShape })}
          >
            <SelectTrigger id="income-shape">
              <SelectValue placeholder={t("choose")}>
                {household.incomeShape ? t(`income.${household.incomeShape}`) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {INCOME_SHAPES.map((s) => (
                <SelectItem key={s} value={s}>{t(`income.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="money-style">{t("moneyStyle")}</Label>
          <Select
            value={household.moneyStyle ?? ""}
            onValueChange={(v) => v && save({ moneyStyle: v as MoneyStyle })}
          >
            <SelectTrigger id="money-style">
              <SelectValue placeholder={t("choose")}>
                {household.moneyStyle ? t(`style.${household.moneyStyle}`) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MONEY_STYLES.map((s) => (
                <SelectItem key={s} value={s}>{t(`style.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </SettingCard>
  );
}

function GentleModeCard() {
  const t = useTranslations("household");
  const { household, save } = useHousehold();
  return (
    <SettingCard>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="gentle-mode" className="font-medium">{t("gentleTitle")}</Label>
          <p className="text-sm text-muted-foreground">{t("gentleDescription")}</p>
        </div>
        <Switch
          id="gentle-mode"
          checked={household.gentleMode}
          onCheckedChange={(v) => save({ gentleMode: v })}
        />
      </div>
    </SettingCard>
  );
}

function LifeEventsCard() {
  const t = useTranslations("household");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { household, save, saving } = useHousehold();
  const [type, setType] = useState<LifeEventType>("birth");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const events = [...household.events].sort((a, b) => b.date.localeCompare(a.date));
  const fmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-IL", {
    year: "numeric",
    month: "long",
  });

  return (
    <SettingCard title={t("eventsTitle")} description={t("eventsDescription")}>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="event-type">{t("eventType")}</Label>
          <Select value={type} onValueChange={(v) => v && setType(v as LifeEventType)}>
            <SelectTrigger id="event-type">
              <SelectValue>{t(`event.${type}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LIFE_EVENTS.map((e) => (
                <SelectItem key={e} value={e}>{t(`event.${e}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="event-date">{t("eventDate")}</Label>
          <Input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Button
          disabled={!date || saving}
          onClick={() => save({ events: [...household.events, { id: newId(), type, date }] })}
        >
          {tCommon("add")}
        </Button>
      </div>
      {events.length > 0 && (
        <ol className="mt-5 space-y-3 border-s border-border ps-4">
          {events.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{t(`event.${e.type}`)}</div>
                <div className="text-xs text-muted-foreground">{fmt.format(new Date(e.date))}</div>
                {/* Benefits: we link out to Kol-Zchut instead of keeping our own rules. */}
                <a
                  href={`https://www.kolzchut.org.il/w/index.php?search=${encodeURIComponent(t(`rightsSearch.${e.type}`))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {t("checkRights")}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                  <span className="sr-only">{t("opensNewTab")}</span>
                </a>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("removeItem", { name: t(`event.${e.type}`) })}
                onClick={() => save({ events: household.events.filter((x) => x.id !== e.id) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ol>
      )}
    </SettingCard>
  );
}
