import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { AskBox } from "@/components/ask/ask-box";

export const dynamic = "force-dynamic";

export default async function Page() {
  const t = await getTranslations("ask");
  return (
    <AppShell>
      <PageHeader title={t("title")} meta={t("subtitle")} />
      <div className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-8">
        <AskBox />
      </div>
    </AppShell>
  );
}
