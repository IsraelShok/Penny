import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Checkin } from "@/components/checkin/checkin";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const t = await getTranslations("checkin");
  return (
    <AppShell>
      <PageHeader title={t("title")} meta={t("subtitle")} />
      <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-3 md:px-6 lg:px-8">
        <Checkin />
      </div>
    </AppShell>
  );
}
