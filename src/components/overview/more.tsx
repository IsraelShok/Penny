import { useTranslations } from "next-intl";

/** One "עוד" disclosure per tab, so the secondary cards wait until asked for. */
export function More({ children }: { children: React.ReactNode }) {
  const t = useTranslations("overview");
  return (
    <details>
      <summary className="print-hidden min-h-11 w-fit cursor-pointer content-center rounded-lg px-1 font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
        {t("more")}
      </summary>
      <div className="mt-3 grid gap-4 md:gap-6">{children}</div>
    </details>
  );
}
