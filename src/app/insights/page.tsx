import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { InsightsView } from "@/components/insights/insights-view";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const t = await getTranslations("insights");
  return (
    <AppShell>
      <PageHeader title={t("title")} />
      <div className="mx-auto w-full max-w-3xl p-4 md:p-6 lg:p-8">
        <InsightsView />
      </div>
    </AppShell>
  );
}
