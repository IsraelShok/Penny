"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileUp, Landmark, Lock, PiggyBank, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Back, Forward } from "@/components/ui/dir-chevron";
import { Input } from "@/components/ui/input";
import { PetFace, PipPicker } from "@/components/home/pet-card";
import { useProfiles } from "@/components/layout/workspace-switcher";
import { NAV } from "@/components/layout/app-sidebar";
import { StatementImportCard } from "@/components/settings/statement-import-card";
import { saveProfile } from "@/lib/api";
import { defaultPip, type ProfilePip } from "@/lib/profile-avatar";
import { BankStep } from "./bank-step";

const eyebrow = "text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground";
const title = "font-semibold text-4xl leading-[1.08] tracking-tight text-balance";

function StepFooter({ onBack, children }: { onBack?: () => void; children: React.ReactNode }) {
  const t = useTranslations("onboarding");
  return (
    <footer className="flex items-center justify-between gap-3 pt-2">
      {onBack ? (
        <Button variant="outline" size="lg" onClick={onBack}>
          <Back /> {t("back")}
        </Button>
      ) : <span />}
      {children}
    </footer>
  );
}

/** Welcome: what the app does, in three lines. */
export function IntroStep({ onComplete }: { onComplete: () => void }) {
  const t = useTranslations("onboarding");
  const points = [
    { Icon: Wallet, key: "introAll" },
    { Icon: PiggyBank, key: "introBudget" },
    { Icon: Sparkles, key: "introFuture" },
    { Icon: Lock, key: "introPrivate" },
  ] as const;
  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-6 pt-4 text-center">
      <PetFace mood="happy" pet={{ color: "", skin: "" }} px={120} />
      <div className="space-y-3">
        <h1 className={title}>{t("introTitle")}</h1>
        <p className="text-pretty text-muted-foreground">{t("introBody")}</p>
      </div>
      <ul className="w-full space-y-3 text-start">
        {points.map(({ Icon, key }) => (
          <li key={key} className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-sm">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <span className="text-sm leading-relaxed">{t(key)}</span>
          </li>
        ))}
      </ul>
      <Button size="lg" onClick={onComplete} autoFocus>
        {t("introStart")} <Forward />
      </Button>
    </div>
  );
}

/** Your profile: a name and your own Pip (look, colour, optional nickname). */
export function ProfileStep({ onComplete, onBack }: { onComplete: () => void; onBack: () => void }) {
  const t = useTranslations("onboarding");
  const tp = useTranslations("profiles");
  const tPet = useTranslations("pet");
  const qc = useQueryClient();
  const { active, isPending } = useProfiles();
  const [draft, setDraft] = useState<{ name: string; pip: ProfilePip } | null>(null);
  // Start from the stored profile once it loads; the seeded "Default" starts with an empty name.
  if (!draft && !isPending) setDraft({ name: active && active.name !== "Default" ? active.name : "", pip: active?.avatarPet ?? defaultPip(active?.id ?? 1) });
  const save = useMutation({
    mutationFn: (d: { name: string; pip: ProfilePip }) => saveProfile(active?.id ?? null, d.name.trim(), { avatarPet: d.pip }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
      onComplete();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : tp("error")),
  });
  if (!draft) return null;
  return (
    <form
      className="mx-auto w-full max-w-[520px] space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.name.trim()) save.mutate(draft);
      }}
    >
      <header className="space-y-2">
        <div className={eyebrow}>{t("stepProfile")}</div>
        <h1 className={title}>{t("profileTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("profileBody")}</p>
      </header>
      <div className="grid place-items-center">
        <PetFace mood="happy" pet={draft.pip} px={130} />
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("profileName")}
        <Input autoFocus required maxLength={60} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-11" />
      </label>
      <PipPicker value={draft.pip} onChange={(v) => setDraft({ ...draft, pip: { ...draft.pip, ...v } })} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {tp("pipName")}
        <Input maxLength={24} value={draft.pip.name} placeholder={tPet("defaultName")} onChange={(e) => setDraft({ ...draft, pip: { ...draft.pip, name: e.target.value } })} className="h-11" />
      </label>
      <StepFooter onBack={onBack}>
        <Button type="submit" size="lg" disabled={!draft.name.trim() || save.isPending}>
          {t("next")} <Forward />
        </Button>
      </StepFooter>
    </form>
  );
}

/** Connect data: the automatic bank connection (the existing bank step) or a file import (the existing import card). */
export function ConnectStep({ onComplete, onBack }: { onComplete: () => void; onBack?: () => void }) {
  const t = useTranslations("onboarding");
  const tSetup = useTranslations("setup");
  const [way, setWay] = useState<"bank" | "file" | null>(null);
  const change = (
    <button type="button" onClick={() => setWay(null)} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
      <Back /> {t("connectOtherWay")}
    </button>
  );
  if (way === "bank") return <div className="space-y-4"><div className="mx-auto max-w-[520px]">{change}</div><BankStep onComplete={onComplete} /></div>;
  if (way === "file") {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        {change}
        <StatementImportCard />
        <StepFooter>
          <Button size="lg" onClick={onComplete}>{t("next")} <Forward /></Button>
        </StepFooter>
      </div>
    );
  }
  const ways = [
    { id: "bank", Icon: Landmark, key: "connectBank" },
    { id: "file", Icon: FileUp, key: "connectFile" },
  ] as const;
  return (
    <div className="mx-auto w-full max-w-[520px] space-y-6">
      <header className="space-y-2">
        <div className={eyebrow}>{tSetup("stepConnect")}</div>
        <h1 className={title}>{t("connectTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("connectBody")}</p>
      </header>
      <div className="grid gap-3">
        {ways.map(({ id, Icon, key }) => (
          <button
            key={id}
            type="button"
            onClick={() => setWay(id)}
            className="flex items-start gap-4 rounded-2xl bg-card p-5 text-start shadow-sm ring-1 ring-border hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
            <span className="space-y-1">
              <span className="block font-semibold">{t(`${key}Title`)}</span>
              <span className="block text-sm text-muted-foreground">{t(`${key}Body`)}</span>
            </span>
          </button>
        ))}
      </div>
      <StepFooter onBack={onBack}>
        <Button variant="ghost" size="lg" onClick={onComplete}>{t("later")}</Button>
      </StepFooter>
    </div>
  );
}

/** A short tour of the main areas, named exactly as in the menu. */
export function TourStep({ onComplete, onBack }: { onComplete: () => void; onBack: () => void }) {
  const t = useTranslations("onboarding");
  const tNav = useTranslations("nav");
  return (
    <div className="mx-auto w-full max-w-[520px] space-y-6">
      <header className="space-y-2">
        <div className={eyebrow}>{t("stepTour")}</div>
        <h1 className={title}>{t("tourTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("tourBody")}</p>
      </header>
      <ol className="space-y-3">
        {NAV.map(({ href, labelKey, Icon }) => (
          <li key={href} className="flex items-start gap-4 rounded-2xl bg-card p-4 shadow-sm">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="space-y-0.5">
              <span className="block font-semibold">{tNav(labelKey)}</span>
              <span className="block text-sm text-muted-foreground">{t(`tour_${labelKey}`)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="rounded-2xl bg-muted/60 p-4 text-sm">{t("tourSearch")}</p>
      <StepFooter onBack={onBack}>
        <Button size="lg" onClick={onComplete}>{t("next")} <Forward /></Button>
      </StepFooter>
    </div>
  );
}
