import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { CarCalculator } from "@/components/car/car-calculator";

export default async function Page() {
  const t = await getTranslations("car");
  return (
    <AppShell>
      <PageHeader title={t("title")} meta={t("subtitle")} />
      <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-3 md:px-6 lg:px-8">
        <CarCalculator />
      </div>
    </AppShell>
  );
}
