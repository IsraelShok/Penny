"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileUp } from "lucide-react";
import { importStatement, undoStatementImport } from "@/lib/api";
import { parseCsv } from "@/lib/csv";
import { readXlsx } from "@/lib/xlsx";
import { buildImportRows, findHeaderRow, guessColumns, IMPORT_FIELDS, MAX_IMPORT_ROWS, type ImportMap } from "@/lib/file-import";
import { SettingCard } from "@/components/settings/section-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "none";

export function StatementImportCard() {
  const t = useTranslations("fileImport");
  const queryClient = useQueryClient();
  const [table, setTable] = useState<string[][]>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [map, setMap] = useState<ImportMap | null>(null);
  const [account, setAccount] = useState("");
  const [positiveIsExpense, setPositiveIsExpense] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);

  const header = table[headerRow] ?? [];
  const { rows, skipped } = useMemo(
    () => (map ? buildImportRows(table.slice(headerRow + 1), map, positiveIsExpense) : { rows: [], skipped: 0 }),
    [table, headerRow, map, positiveIsExpense],
  );
  const tooMany = rows.length > MAX_IMPORT_ROWS;
  const deferredAccount = useDeferredValue(account.trim());

  const check = useQuery({
    queryKey: ["file-import-check", deferredAccount, rows],
    queryFn: () => importStatement(deferredAccount, rows, true),
    enabled: !!deferredAccount && rows.length > 0 && !tooMany,
  });

  function reset() {
    setTable([]);
    setMap(null);
    setError(null);
    setInputKey((k) => k + 1);
  }

  const save = useMutation({
    mutationFn: () => importStatement(account.trim(), rows),
    onSuccess: (res) => {
      const refresh = () => {
        for (const key of ["transactions", "summary", "home", "file-import-check"]) queryClient.invalidateQueries({ queryKey: [key] });
      };
      refresh();
      reset();
      const batchId = res.batchId;
      toast.success(t("saved", { added: res.added, duplicates: res.duplicates }), batchId
        ? { action: { label: t("undo"), onClick: () => void undoStatementImport(batchId).then(refresh) } }
        : undefined);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("saveFailed")),
  });

  async function onFile(file: File | undefined) {
    setError(null);
    setTable([]);
    setMap(null);
    if (!file) return;
    const name = file.name.toLowerCase();
    try {
      let parsed: string[][];
      if (name.endsWith(".xls")) { setError(t("xlsNotSupported")); return; }
      if (name.endsWith(".xlsx")) parsed = await readXlsx(await file.arrayBuffer());
      else {
        const bytes = await file.arrayBuffer();
        // Israeli bank CSVs are often Windows-1255, not UTF-8.
        let text = new TextDecoder("utf-8").decode(bytes);
        if (text.includes("�")) text = new TextDecoder("windows-1255").decode(bytes);
        parsed = parseCsv(text);
      }
      const h = findHeaderRow(parsed);
      if (h < 0) { setError(t("noHeader")); return; }
      setTable(parsed);
      setHeaderRow(h);
      setMap(guessColumns(parsed[h]));
    } catch {
      setError(t("readFailed"));
    }
  }

  const ready = check.data?.ready ?? rows.length;
  const duplicates = check.data?.duplicates ?? 0;

  return (
    <SettingCard title={t("title")} description={t("description")}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="statement-file">{t("file")}</Label>
          <input
            key={inputKey}
            id="statement-file"
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => void onFile(e.target.files?.[0])}
            className="block w-full text-footnote file:me-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-footnote file:font-medium file:text-secondary-foreground"
          />
          <p className="text-caption text-muted-foreground">{t("fileHint")}</p>
        </div>

        {error && <p className="rounded-xl bg-muted/50 px-3 py-2 text-footnote" role="status">{error}</p>}

        {map && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {IMPORT_FIELDS.map((f) => (
                <div key={f} className="space-y-1.5">
                  <Label>{t(`column_${f}`)}</Label>
                  <Select
                    value={map[f] == null ? NONE : String(map[f])}
                    onValueChange={(v) => v && setMap((m) => m && { ...m, [f]: v === NONE ? null : Number(v) })}
                  >
                    <SelectTrigger className="w-full" aria-label={t(`column_${f}`)}>
                      <SelectValue>{(v: string) => (v === NONE ? t("columnNone") : header[Number(v)] || `#${Number(v) + 1}`)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t("columnNone")}</SelectItem>
                      {header.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `#${i + 1}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {map.amount != null && (
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="positive-expense">{t("positiveIsExpense")}</Label>
                <Switch id="positive-expense" checked={positiveIsExpense} onCheckedChange={setPositiveIsExpense} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="statement-account">{t("account")}</Label>
              <Input id="statement-account" value={account} maxLength={40} placeholder={t("accountPlaceholder")} onChange={(e) => setAccount(e.target.value)} />
              <p className="text-caption text-muted-foreground">{t("accountHint")}</p>
            </div>

            {rows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-footnote">
                  <caption className="sr-only">{t("previewCaption")}</caption>
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-start font-medium">{t("column_date")}</th>
                      <th scope="col" className="px-3 py-2 text-start font-medium">{t("column_description")}</th>
                      <th scope="col" className="px-3 py-2 text-end font-medium">{t("column_amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{r.date.split("-").reverse().join("/")}</td>
                        <td className="max-w-48 truncate px-3 py-1.5">{r.description}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-end tabular-nums" dir="ltr">{r.amount.toLocaleString("he-IL", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-footnote text-muted-foreground" aria-live="polite">
              {tooMany ? t("tooMany", { max: MAX_IMPORT_ROWS }) : t("summary", { ready, skipped, duplicates })}
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>{t("cancel")}</Button>
              <Button disabled={!account.trim() || ready === 0 || tooMany || save.isPending} onClick={() => save.mutate()}>
                <FileUp className="size-4" aria-hidden />
                {save.isPending ? t("saving") : t("save", { count: ready })}
              </Button>
            </div>
          </>
        )}
      </div>
    </SettingCard>
  );
}
