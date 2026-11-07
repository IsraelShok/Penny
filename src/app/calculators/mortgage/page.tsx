import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { MortgageCalculator } from "@/components/calculators/mortgage-calculator";

export default async function Page() {
  const t = await getTranslations("calculators");
  return (
    <AppShell>
      <PageHeader title={t("item.mortgage.title")} meta={t("item.mortgage.hint")} />
      <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-3 md:px-6 lg:px-8">
        <MortgageCalculator />
      </div>
    </AppShell>
  );
}
