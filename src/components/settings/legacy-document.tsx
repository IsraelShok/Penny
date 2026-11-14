"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, FileJson, FolderOpen, Lock, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/segmented";
import { SectionShell, SettingCard } from "@/components/settings/section-shell";
import { getAssets, getInsights, listIntegrations, getLegacyNotes, getOwners, getPlan, getSettings, saveLegacyNotes, getLegacyExport, updateLegacyExport, postLegacyExport, type LegacyExportConfig } from "@/lib/api";
import { buildLegacySections, LEGACY_TEXT_MAX, type LegacyNotes, type LegacyRow } from "@/lib/legacy";
import { shekels } from "@/lib/money";
import { BANK_PROVIDERS } from "@/lib/types";
import { translateProviderName } from "@/lib/i18n-data";

/** Owned by this page only: paper look on screen, and print rules (white, page break per section). */
const LEGACY_CSS = `
.legacy-doc{background:var(--card,#fff);color:var(--foreground,#1c1c1e);font:15px/1.6 -apple-system,"SF Pro Text","Segoe UI",Arial,sans-serif;border-radius:18px;padding:32px;max-width:52rem;margin:0 auto}
.legacy-doc h1{font-size:26px;margin:0 0 4px}
.legacy-doc .meta{color:var(--muted-foreground,#6e6e73);font-size:14px;margin:0 0 16px}
.legacy-doc .intro{background:var(--muted,#f2f2f7);border-radius:12px;padding:12px 16px;font-size:14px}
.legacy-doc section{margin-top:28px}
.legacy-doc h2{font-size:19px;margin:0 0 6px;border-bottom:1px solid var(--border,#e5e5ea);padding-bottom:6px}
.legacy-doc .hint{color:var(--muted-foreground,#6e6e73);font-size:13px;margin:0 0 8px}
.legacy-doc table{width:100%;border-collapse:collapse;font-size:14px}
.legacy-doc td{padding:7px 4px;border-bottom:1px solid var(--border,#f2f2f7);vertical-align:top}
.legacy-doc td.num{text-align:end;white-space:nowrap;font-variant-numeric:tabular-nums}
.legacy-doc .sub{color:var(--muted-foreground,#6e6e73);font-size:13px}
.legacy-doc .empty{color:var(--muted-foreground,#8e8e93);font-size:14px}
.legacy-doc .text{white-space:pre-wrap}
.legacy-doc ol{padding-inline-start:22px;margin:0}
.legacy-doc ol li{margin:4px 0}
@media print{
  .legacy-doc{--card:#fff;--foreground:#1c1c1e;--muted:#f2f2f7;--muted-foreground:#6e6e73;--border:#e5e5ea;border-radius:0;padding:0;max-width:none;font-size:13pt}
  .legacy-doc section{break-before:page}
  .legacy-doc tr{break-inside:avoid}
  .legacy-print-hidden,aside{display:none!important}
}
`;

const today = () => new Date().toISOString().slice(0, 10);
const yearAgo = () => new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);

export function LegacyDocument() {
  const t = useTranslations("legacy");
  const tBanks = useTranslations("banks");
  const locale = useLocale();
  const qc = useQueryClient();
  const docRef = useRef<HTMLDivElement>(null);


  const assets = useQuery({ queryKey: ["assets"], queryFn: getAssets });
  const plan = useQuery({ queryKey: ["plan"], queryFn: getPlan });
  const settings = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const integrations = useQuery({ queryKey: ["integrations"], queryFn: listIntegrations });
  const insights = useQuery({ queryKey: ["insights"], queryFn: getInsights });
  const owners = useQuery({ queryKey: ["owners", "legacy"], queryFn: () => getOwners(yearAgo(), today()) });
  const notesQ = useQuery({ queryKey: ["legacy-notes"], queryFn: getLegacyNotes });

  const save = useMutation({
    mutationFn: saveLegacyNotes,
    onSuccess: (data) => qc.setQueryData(["legacy-notes"], data),
    onError: () => toast.error(t("saveError")),
  });

  const notes = notesQ.data;
  const sections = buildLegacySections({
    assets: assets.data?.assets ?? [],
    policies: plan.data?.policies ?? [],
    goals: plan.data?.goals ?? [],
    integrations: integrations.data ?? [],
    accounts: owners.data?.accounts ?? [],
    recurring: insights.data?.series ?? [],
    providerName: (id) => translateProviderName(id, BANK_PROVIDERS.find((b) => b.id === id)?.name ?? id, tBanks),
  });
  const me = settings.data?.household?.members.find((m) => m.role === "me")?.name || settings.data?.displayName || "";
  const dateText = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date());
  const money = (n: number | null | undefined) => (n == null ? "" : shekels(n, locale));
  const steps = (notes?.steps ?? t("defaultSteps")).split("\n").map((s) => s.trim()).filter(Boolean);

  const download = (name: string, type: string, body: string) => {
    const url = URL.createObjectURL(new Blob([body], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
  };
  const docHtml = () =>
    `<!doctype html><html lang="${locale}" dir="${locale === "he" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t("docTitle")}</title><style>body{margin:0;padding:24px;background:#f2f2f7}${LEGACY_CSS}</style></head><body>${docRef.current?.outerHTML ?? ""}</body></html>`;
  const exportHtml = () => download(`family-document-${today()}.html`, "text/html", docHtml());
  const exportJson = () =>
    download(`family-document-${today()}.json`, "application/json", JSON.stringify({ generatedAt: new Date().toISOString(), owner: me, notes, sections }, null, 2));

  const loading = [assets, plan, settings].some((q) => q.isLoading);

  const autoQ = useQuery({ queryKey: ["legacy-export"], queryFn: getLegacyExport });
  const auto = autoQ.data;
  const sentRef = useRef("");
  // While auto-export is on, every change to the rendered document (or folder) is sent and written, debounced.
  useEffect(() => {
    if (!auto?.enabled || loading || !docRef.current) return;
    const html = docHtml();
    const key = auto.dir + html;
    if (key === sentRef.current) return;
    const id = setTimeout(() => {
      sentRef.current = key;
      postLegacyExport({ html }).then((d) => qc.setQueryData(["legacy-export"], d)).catch(() => {});
    }, 2000);
    return () => clearTimeout(id);
  });

  return (
    <SectionShell title={t("title")} description={t("description")}>
      <style>{LEGACY_CSS}</style>
      <div className="legacy-print-hidden print-hidden space-y-4">
        <div className="flex gap-3 rounded-2xl bg-primary/10 p-4 text-sm leading-relaxed" role="note">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p>{t("privacyNotice")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.print()}><Printer className="h-4 w-4" />{t("print")}</Button>
          <Button variant="outline" onClick={exportHtml}><Download className="h-4 w-4" />{t("downloadHtml")}</Button>
          <Button variant="outline" onClick={exportJson}><FileJson className="h-4 w-4" />{t("downloadJson")}</Button>
        </div>
        {notes && (
          <SettingCard title={t("notesTitle")} description={t("notesDescription")}>
            <div className="space-y-4">
              {(["contacts", "documents", "wishes", "steps"] as const).map((k) => (
                <NoteField
                  key={`${k}:${notes[k] ?? ""}`}
                  id={`legacy-${k}`}
                  label={t(`fields.${k}`)}
                  placeholder={t(`placeholders.${k}`)}
                  initial={k === "steps" ? notes.steps ?? t("defaultSteps") : notes[k]}
                  onSave={(v) => save.mutate({ ...notes, [k]: v } as LegacyNotes)}
                />
              ))}
            </div>
          </SettingCard>
        )}
        {auto && <AutoExportCard config={auto} onChange={(d) => qc.setQueryData(["legacy-export"], d)} />}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : (
        <div ref={docRef} className="legacy-doc" dir={locale === "he" ? "rtl" : "ltr"}>
          <h1>{t("docTitle")}</h1>
          <p className="meta">{me ? t("belongsTo", { name: me, date: dateText }) : t("dated", { date: dateText })}</p>
          <p className="intro">{t("docIntro")}</p>

          {sections.map((s) => (
            <section key={s.id}>
              <h2>{t(`sections.${s.id}`)}</h2>
              {t.has(`hints.${s.id}`) && <p className="hint">{t(`hints.${s.id}`)}</p>}
              {s.rows.length === 0 ? (
                <p className="empty">{t("nothingHere")}</p>
              ) : (
                <table>
                  <tbody>
                    {s.rows.map((r, i) => (
                      <tr key={i}>
                        <td>
                          <div>{r.title}</div>
                          <div className="sub">{rowSub(r, t)}</div>
                        </td>
                        <td className="num">
                          {r.amount != null && <div>{money(r.amount)}</div>}
                          {r.saved != null && <div className="sub">{t("saved", { amount: money(r.saved) })}</div>}
                          {r.monthly != null && <div className={r.amount != null ? "sub" : undefined}>{t("perMonth", { amount: money(r.monthly) })}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))}

          {(["contacts", "documents", "wishes"] as const).map((k) => (
            <section key={k}>
              <h2>{t(`fields.${k}`)}</h2>
              {notes?.[k]?.trim() ? <p className="text">{notes[k]}</p> : <p className="empty">{t("notWrittenYet")}</p>}
            </section>
          ))}
          <section>
            <h2>{t("fields.steps")}</h2>
            <p className="hint">{t("stepsIntro")}</p>
            <ol>{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </section>
        </div>
      )}
    </SectionShell>
  );
}

function rowSub(r: LegacyRow, t: ReturnType<typeof useTranslations<"legacy">>) {
  const parts = [r.kind && t.has(`kinds.${r.kind}`) ? t(`kinds.${r.kind}`) : null, r.detail, r.when ? t("when", { when: r.when }) : null];
  return parts.filter(Boolean).join(" · ");
}

function NoteField({ id, label, placeholder, initial, onSave }: { id: string; label: string; placeholder: string; initial: string; onSave: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        value={value}
        rows={4}
        maxLength={LEGACY_TEXT_MAX}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== initial && onSave(value)}
        className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

function AutoExportCard({ config, onChange }: { config: LegacyExportConfig; onChange: (c: LegacyExportConfig) => void }) {
  const t = useTranslations("legacy.auto");
  const locale = useLocale();
  const [dir, setDir] = useState(config.dir);
  const update = useMutation({ mutationFn: updateLegacyExport, onSuccess: onChange, onError: () => toast.error(t("badPath")) });
  const open = useMutation({ mutationFn: () => postLegacyExport({ action: "open" }), onError: () => toast.error(t("openError")) });
  const last = config.lastAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(config.lastAt)) : null;
  return (
    <SettingCard title={t("title")} description={t("description")}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="legacy-auto">{t("enable")}</Label>
          <Switch id="legacy-auto" checked={config.enabled} onCheckedChange={(v) => update.mutate({ enabled: v })} />
        </div>
        <Segmented
          label={t("frequency")}
          value={config.frequency}
          onChange={(v) => update.mutate({ frequency: v })}
          options={[{ value: "weekly", label: t("weekly") }, { value: "monthly", label: t("monthly") }]}
        />
        <div className="space-y-1.5">
          <Label htmlFor="legacy-dir">{t("folder")}</Label>
          <Input id="legacy-dir" dir="ltr" value={dir} onChange={(e) => setDir(e.target.value)} onBlur={() => dir.trim() !== config.dir && update.mutate({ dir })} />
          <p className="text-xs text-muted-foreground">{t("secureHint")}</p>
        </div>
        <p className="text-sm text-muted-foreground" role="status">
          {last ? t("last", { date: last }) : t("never")}
          {" · "}
          <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => open.mutate()}>
            <FolderOpen className="me-1 inline h-3.5 w-3.5" aria-hidden />{t("openFolder")}
          </button>
        </p>
        {config.status === "locked" && <p className="text-sm text-muted-foreground">{t("locked")}</p>}
        {config.status === "error" && <p role="alert" className="text-sm text-destructive">{t("error")}</p>}
      </div>
    </SettingCard>
  );
}