"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { fmt, shekels } from "@/lib/money";
import { IL } from "@/lib/il-defaults";
import { netSalary } from "@/lib/net-salary";
import { freelanceSetAside, nextVatDue } from "@/lib/freelance";
import { useHousehold } from "@/hooks/use-household";
import { CardShell } from "@/components/home/card-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";

type Mode = "salaried" | "self";

/** Gross → net for employees, monthly set-asides for the self-employed. Inputs stay on this screen only. */
export function TakeHome() {
  const t = useTranslations("freelance");
  const { household } = useHousehold();
  const auto: Mode =
    household.incomeShape === "freelancer" || household.incomeShape === "mixed"
      ? "self"
      : "salaried";
  const [picked, setPicked] = useState<Mode | null>(null);
  const mode = picked ?? auto;
  return (
    <CardShell label={t("title")}>
      <Segmented
        label={t("title")}
        value={mode}
        onChange={setPicked}
        options={[
          { value: "salaried", label: t("salaried") },
          { value: "self", label: t("self") },
        ]}
        className="mb-4"
      />
      {mode === "salaried" ? <Salaried /> : <SelfEmployed />}
      <p className="mt-4 text-caption text-pretty text-muted-foreground">
        {t("note", { year: IL.year })}
      </p>
    </CardShell>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-caption">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        value={value || ""}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
    </div>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-4 space-y-1.5 text-footnote">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="figure">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Salaried() {
  const t = useTranslations("freelance");
  const locale = useLocale();
  const [gross, setGross] = useState(15_000);
  const [sex, setSex] = useState<"man" | "woman">("man");
  const [extra, setExtra] = useState(0);
  const [pensionPct, setPensionPct] = useState(6);
  const [studyPct, setStudyPct] = useState(2.5);
  const r = netSalary({
    gross,
    sex,
    extraPoints: extra,
    pensionRate: pensionPct / 100,
    studyFundRate: studyPct / 100,
  });
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <NumberField id="th-gross" label={t("gross")} value={gross} onChange={setGross} />
        <div className="space-y-1.5">
          <span className="block text-caption">{t("points")}</span>
          <Segmented
            label={t("points")}
            value={sex}
            onChange={setSex}
            options={[
              { value: "man", label: t("man") },
              { value: "woman", label: t("woman") },
            ]}
          />
        </div>
        <NumberField id="th-extra" label={t("extraPoints")} value={extra} onChange={setExtra} />
        <NumberField
          id="th-pension"
          label={t("pensionPct")}
          value={pensionPct}
          onChange={setPensionPct}
        />
        <NumberField id="th-study" label={t("studyPct")} value={studyPct} onChange={setStudyPct} />
      </div>
      <p className="mt-4 text-footnote">{t("netLead")}</p>
      <p className="figure text-[2.5rem] leading-none">{shekels(r.net, locale)}</p>
      <Rows
        rows={[
          [t("incomeTax"), shekels(r.incomeTax, locale)],
          [t("bituach"), shekels(r.bituach, locale)],
          [t("pension"), shekels(r.pension, locale)],
          [t("studyFund"), shekels(r.studyFund, locale)],
          [t("effective"), `${fmt(r.effectiveTaxRate * 100, locale, 1)}%`],
        ]}
      />
    </>
  );
}

function SelfEmployed() {
  const t = useTranslations("freelance");
  const locale = useLocale();
  const [income, setIncome] = useState(15_000);
  const [expenses, setExpenses] = useState(2_000);
  const [advancePct, setAdvancePct] = useState(10);
  const [vatRegistered, setVatRegistered] = useState(false);
  const r = freelanceSetAside({ income, expenses, advanceRate: advancePct / 100, vatRegistered });
  const due = nextVatDue(new Date()).toLocaleDateString(locale === "he" ? "he-IL" : "en-US", {
    day: "numeric",
    month: "long",
  });
  return (
    <>
      <p className="mb-4 text-headline text-pretty">
        {t("lead", { amount: shekels(r.total, locale) })}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField id="th-income" label={t("income")} value={income} onChange={setIncome} />
        <NumberField
          id="th-expenses"
          label={t("expenses")}
          value={expenses}
          onChange={setExpenses}
        />
        <NumberField
          id="th-advance"
          label={t("advancePct")}
          value={advancePct}
          onChange={setAdvancePct}
        />
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-3 text-footnote">
        <input
          type="checkbox"
          className="size-4 accent-[var(--foreground)]"
          checked={vatRegistered}
          onChange={(e) => setVatRegistered(e.target.checked)}
        />
        {t("vatRegistered")}
      </label>
      <Rows
        rows={[
          [t("advance"), shekels(r.taxAdvance, locale)],
          [t("bituach"), shekels(r.bituach, locale)],
          [t("pensionMin"), shekels(r.pension, locale)],
          ...(vatRegistered
            ? [[t("vat", { rate: IL.vat.rate * 100 }), shekels(r.vat, locale)] as [string, string]]
            : []),
        ]}
      />
      {vatRegistered && <p className="mt-3 text-footnote">{t("vatDue", { date: due })}</p>}
    </>
  );
}
