import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { MoreHub } from "@/components/more/more-hub";

export default async function MorePage() {
  const t = await getTranslations("moreHub");
  return (
    <AppShell>
      <PageHeader title={t("title")} meta={t("subtitle")} />
      <div className="mx-auto w-full max-w-5xl p-4 md:p-6 lg:p-8">
        <MoreHub />
      </div>
    </AppShell>
  );
}
