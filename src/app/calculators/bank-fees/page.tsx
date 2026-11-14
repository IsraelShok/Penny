import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { BankFeesAudit } from "@/components/calculators/life-tools";

export default async function Page() {
  const t = await getTranslations("lifeTools.bankFees");
  return (
    <AppShell>
      <PageHeader title={t("title")} meta={t("hint")} />
      <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-3 md:px-6 lg:px-8">
        <BankFeesAudit />
      </div>
    </AppShell>
  );
}
