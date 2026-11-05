import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { RulesView } from "@/components/rules/rules-view";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const t = await getTranslations("rules");
  return (
    <AppShell>
      <PageHeader title={t("title")} />
      <div className="mx-auto w-full max-w-3xl p-4 md:p-6 lg:p-8">
        <RulesView />
      </div>
    </AppShell>
  );
}
