import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { JourneyView } from "@/components/household/journey-view";

export const dynamic = "force-dynamic";

export default async function Page() {
  const t = await getTranslations("journey");
  return (
    <AppShell>
      <PageHeader title={t("title")} />
      <div className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-8">
        <JourneyView />
      </div>
    </AppShell>
  );
}
