import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { MoreHub } from "@/components/more/more-hub";

export default async function MorePage() {
  const t = await getTranslations("moreHub");
  return (
    <AppShell>
      <PageHeader title={t("title")} largeTitle={false} />
      <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-3 md:px-6 lg:px-8">
        <MoreHub />
      </div>
    </AppShell>
  );
}
