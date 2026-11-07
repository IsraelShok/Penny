import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { LearnHub } from "@/components/learn/learn";

export default async function Page() {
  const t = await getTranslations("learn");
  return (
    <AppShell>
      <PageHeader title={t("title")} meta={t("subtitle")} />
      <div className="mx-auto w-full max-w-4xl px-4 pb-8 pt-3 md:px-6 lg:px-8">
        <LearnHub />
      </div>
    </AppShell>
  );
}
