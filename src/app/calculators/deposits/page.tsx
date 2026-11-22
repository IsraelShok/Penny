import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { DepositOptimizer } from "@/components/more/tax-tools";

export default async function Page() {
  const t = await getTranslations("calculators");
  return (
    <AppShell>
      <PageHeader
        title={t("deposits_title")}
        actions={
          <Link href="/more" className="text-footnote font-medium text-primary">
            {t("back")}
          </Link>
        }
      />
      <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-3 md:px-6 lg:px-8">
        <DepositOptimizer />
      </div>
    </AppShell>
  );
}
