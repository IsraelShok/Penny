import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { OverviewView } from "@/components/overview/overview-view";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const t = await getTranslations("overview");
  return (
    <AppShell>
      <PageHeader title={t("title")} meta={t("subtitle")} />
      <div className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-8">
        <OverviewView />
      </div>
    </AppShell>
  );
}
