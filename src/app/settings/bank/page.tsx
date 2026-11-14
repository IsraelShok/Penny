"use client";

import { Forward } from "@/components/ui/dir-chevron";
import { Suspense, useMemo, useState } from "react";
import { SyncActions } from "@/components/layout/sidebar-sync";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  RefreshCw,
  Loader2,
  CircleCheck,
  CircleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ProviderBadge } from "@/components/setup/provider-badge";
import { SectionShell } from "@/components/settings/section-shell";
import { BankDetailSheet } from "@/components/settings/bank-detail-sheet";
import { useBankSync } from "@/components/settings/use-bank-sync";
import { listIntegrations } from "@/lib/api";
import { BANK_PROVIDERS } from "@/lib/types";
import { translateProviderName, useFormatterLabels } from "@/lib/i18n-data";
import { formatLastSync } from "@/lib/formatters";
import type { Integration } from "@/lib/types";
import { InvestmentHouses } from "@/components/settings/investment-houses";

interface SheetState {
  open: boolean;
  mode: "edit" | "add";
  providerId: string | null;
  credentialId: number | null;
}

export default function BankSettingsPage() {
  const t = useTranslations("settings.bank");
  const tBanks = useTranslations("banks");
  const labels = useFormatterLabels();
  const locale = useLocale();

  const { data: integrations = [], isPending, isError, refetch } = useQuery({
    queryKey: ["integrations"],
    queryFn: listIntegrations,
  });
  const { start, stateFor } = useBankSync();
  const [sheet, setSheet] = useState<SheetState>({
    open: false,
    mode: "edit",
    providerId: null,
    credentialId: null,
  });

  const lastSync = useMemo(() => {
    const stamps = integrations
      .map((i) => i.lastSyncAt)
      .filter((s): s is string => Boolean(s));
    if (stamps.length === 0) return null;
    return stamps.sort().slice(-1)[0];
  }, [integrations]);

  const availableToAdd = BANK_PROVIDERS.filter((b) => b.enabled);

  const sheetIntegration: Integration | null =
    sheet.mode === "edit" && sheet.credentialId != null
      ? integrations.find((i) => i.id === sheet.credentialId) ?? null
      : null;

  const countLabel =
    integrations.length === 1
      ? t("banksConnectedOne", { count: integrations.length })
      : t("banksConnectedOther", { count: integrations.length });

  return (
    <>
      <SectionShell title={t("title")} description={t("description")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="px-4 text-footnote text-muted-foreground">
            {countLabel}
            {lastSync ? (
              <>
                {" · "}
                <span className="text-foreground/80">
                  {t("lastSync", { time: formatLastSync(lastSync, labels) })}
                </span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Suspense fallback={null}><SyncActions /></Suspense>
          </div>
        </div>

        {isPending ? <p role="status">{t("loading")}</p> : isError ? <div role="alert"><p>{t("loadFailed")}</p><Button variant="outline" className="mt-3" onClick={() => void refetch()}>{t("retry")}</Button></div> : integrations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {t.rich("noneConnectedPrompt", {
              addBankBold: (chunks) => <b>{chunks}</b>,
            })}
          </div>
        ) : (
          <section aria-labelledby="banks-connected">
          <h3 id="banks-connected" className="mb-2 px-4 text-sm font-semibold text-muted-foreground">{t("groupConnected", { count: integrations.length })}</h3>
          <div className="overflow-hidden rounded-2xl bg-card">
            <ul className="divide-y divide-border/60">
              {[...integrations].sort((x, y) => x.label.localeCompare(y.label, locale)).map((integration) => {
                const info = BANK_PROVIDERS.find(
                  (b) => b.id === integration.provider
                );
                if (!info) return null;
                const sync = stateFor(integration.id);
                const localName = translateProviderName(info.id, info.name, tBanks);
                const openSheet = () =>
                  setSheet({
                    open: true,
                    mode: "edit",
                    providerId: integration.provider,
                    credentialId: integration.id,
                  });
                const subline = integration.lastSyncAt
                  ? t("transactionsCountWithSync", {
                      count: integration.transactionCount,
                      time: formatLastSync(integration.lastSyncAt, labels),
                    })
                  : t("transactionsCountNever", {
                      count: integration.transactionCount,
                    });
                return (
                  <li
                    key={integration.id}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <button
                      type="button"
                      onClick={openSheet}
                      aria-label={t("openDetails", {
                        name: `${integration.label} (${localName})`,
                      })}
                      className="flex min-w-0 flex-1 items-center gap-3 text-start"
                    >
                      <ProviderBadge
                        color={info.color}
                        name={localName}
                        domain={info.domain}
                        size={36}
                        radius={9}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {integration.label}
                          <StatusPill
                            lastSyncAt={integration.lastSyncAt}
                            syncing={sync.syncing}
                          />
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {localName}
                          {" · "}
                          {t(info.kind === "bank" ? "kindBank" : "kindCard")}
                          {" · "}
                          {subline}
                        </div>
                      </div>
                    </button>
                    <SyncShortButton
                      syncing={sync.syncing}
                      stage={sync.stage}
                      onClick={() => start(integration.id)}
                    />
                    <button
                      type="button"
                      onClick={openSheet}
                      aria-label={t("openDetails", {
                        name: `${integration.label} (${localName})`,
                      })}
                      className="-me-1 shrink-0 rounded-md p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                    >
                      <Forward />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          </section>
        )}
        {/* Every provider we can read, connected or not, so nothing is hidden in a menu. */}
        {!isPending && !isError && (() => {
          const connected = new Set(integrations.map((i) => i.provider));
          const rest = availableToAdd.filter((b) => !connected.has(b.id));
          const groups = (["bank", "card"] as const).map((kind) => ({ kind, items: rest.filter((b) => b.kind === kind).sort((x, y) => translateProviderName(x.id, x.name, tBanks).localeCompare(translateProviderName(y.id, y.name, tBanks), locale)) })).filter((g) => g.items.length);
          return groups.length > 0 && (
            <>
              {groups.map((g) => (
                <section key={g.kind} aria-labelledby={`not-connected-${g.kind}`}>
                  <h3 id={`not-connected-${g.kind}`} className="mb-2 px-4 text-sm font-semibold text-muted-foreground">{t(g.kind === "bank" ? "groupBanks" : "groupCards")}</h3>
                  <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-card">
                    {g.items.map((b) => {
                      const name = translateProviderName(b.id, b.name, tBanks);
                      return (
                        <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                          <ProviderBadge color={b.color} name={name} domain={b.domain} size={36} radius={9} />
                          <span title={name} className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                          <Button variant="outline" size="sm" onClick={() => setSheet({ open: true, mode: "add", providerId: b.id, credentialId: null })}>{t("connect")}</Button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </>
          );
        })()}
        <InvestmentHouses />
      </SectionShell>

      <BankDetailSheet
        open={sheet.open}
        mode={sheet.mode}
        providerId={sheet.providerId}
        credentialId={sheet.credentialId}
        connected={sheetIntegration}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
      />
    </>
  );
}

function StatusPill({
  lastSyncAt,
  syncing,
}: {
  lastSyncAt: string | null;
  syncing: boolean;
}) {
  const t = useTranslations("settings.bank");
  if (syncing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> {t("statusSyncing")}
      </span>
    );
  }
  if (!lastSyncAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--status-heads-up)]/15 px-1.5 py-0.5 text-xs text-[var(--status-heads-up)]">
        <CircleAlert className="h-3 w-3" /> {t("statusNeverSynced")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
      <CircleCheck className="h-3 w-3" /> {t("statusConnected")}
    </span>
  );
}

function SyncShortButton({
  syncing,
  stage,
  onClick,
}: {
  syncing: boolean;
  stage: string;
  onClick: () => void;
}) {
  const t = useTranslations("settings.bank");
  if (syncing) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden sm:inline">{stage || t("syncing")}</span>
      </span>
    );
  }
  return (
    <IconButton showLabel label={t("syncShort")} className="shrink-0" onClick={onClick}>
      <RefreshCw className="size-4" aria-hidden />
    </IconButton>
  );
}
