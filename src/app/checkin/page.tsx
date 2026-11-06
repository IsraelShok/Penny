import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Checkin } from "@/components/checkin/checkin";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const t = await getTranslations("checkin");
  return (
    <AppShell>
      <PageHeader title={t("title")} meta={t("subtitle")} />
      <div className="mx-auto w-full max-w-2xl p-4 md:p-6 lg:p-8">
        <Checkin />
      </div>
    </AppShell>
  );
}
