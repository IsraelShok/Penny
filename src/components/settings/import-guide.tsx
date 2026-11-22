"use client";

import { useTranslations } from "next-intl";
import { IMPORT_FORMATS, MAX_IMPORT_ROWS } from "@/lib/file-import";

const STEPS = ["login", "find", "range", "download", "upload"] as const;

/** How to get a statement file and what the reader accepts. The table comes from the reader's own format list. */
export function ImportGuide() {
  const t = useTranslations("fileImport.guide");
  return (
    <div className="space-y-4 text-footnote">
      <ol className="list-decimal space-y-1.5 ps-5">
        {STEPS.map((s) => (
          <li key={s}>{t(`step_${s}`)}</li>
        ))}
      </ol>
      {/* Phones: a stacked list; the three-column table is too cramped under 640px. */}
      <ul aria-label={t("tableCaption")} className="divide-y rounded-xl border sm:hidden">
        {IMPORT_FORMATS.map((f) => (
          <li key={f.ext} className="px-3 py-2">
            <bdi className="block font-medium">{f.label}</bdi>
            <span className="block text-muted-foreground">{t(`note_${f.note}`)}</span>
          </li>
        ))}
        <li className="px-3 py-2 text-muted-foreground">
          {t("colSources")}: {t("sourcesAll")}
        </li>
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border sm:block">
        <table className="w-full">
          <caption className="sr-only">{t("tableCaption")}</caption>
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-start font-medium">
                {t("colFormat")}
              </th>
              <th scope="col" className="px-3 py-2 text-start font-medium">
                {t("colSources")}
              </th>
              <th scope="col" className="px-3 py-2 text-start font-medium">
                {t("colNote")}
              </th>
            </tr>
          </thead>
          <tbody>
            {IMPORT_FORMATS.map((f) => (
              <tr key={f.ext} className="border-t align-top">
                <td className="whitespace-nowrap px-3 py-1.5" dir="ltr">
                  {f.label}
                </td>
                <td className="px-3 py-1.5">{t("sourcesAll")}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{t(`note_${f.note}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="list-disc space-y-1.5 ps-5 text-muted-foreground">
        <li>{t("columns")}</li>
        <li>{t("limits", { max: MAX_IMPORT_ROWS })}</li>
        <li>{t("duplicates")}</li>
        <li>{t("privacy")}</li>
        <li>{t("folder")}</li>
      </ul>
    </div>
  );
}
