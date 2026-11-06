import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { LifeStages } from "@/components/life/life-stages";

export const dynamic = "force-dynamic";

export default async function Page() {
  const t = await getTranslations("life");
  return (
    <AppShell>
      <PageHeader title={t("title")} meta={t("subtitle")} />
      <div className="mx-auto w-full max-w-3xl p-4 md:p-6 lg:p-8">
        <LifeStages />
      </div>
    </AppShell>
  );
}
