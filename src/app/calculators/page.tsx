import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { CalculatorsHub } from "@/components/calculators/calculators";

export default async function Page() {
  const t = await getTranslations("calculators");
  return (
    <AppShell>
      <PageHeader title={t("page.title")} meta={t("page.hint")} />
      <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-3 md:px-6 lg:px-8">
        <CalculatorsHub />
      </div>
    </AppShell>
  );
}
