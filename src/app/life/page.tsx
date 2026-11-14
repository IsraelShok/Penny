import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { LifeStages } from "@/components/life/life-stages";

export const dynamic = "force-dynamic";

export default async function Page() {
  const t = await getTranslations("life");
  return (
    <AppShell>
      <PageHeader title={t("title")} largeTitle={false} />
      <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-3 md:px-6 lg:px-8">
        <LifeStages />
      </div>
    </AppShell>
  );
}
