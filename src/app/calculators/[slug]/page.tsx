import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { CalculatorView } from "@/components/more/calculators";
import { CALC_SLUGS, type CalcSlug } from "@/lib/calculators";

export default async function CalculatorPage({ params }: PageProps<"/calculators/[slug]">) {
  const { slug } = await params;
  if (!CALC_SLUGS.includes(slug as CalcSlug)) notFound();
  const t = await getTranslations("calculators");
  return (
    <AppShell>
      <PageHeader title={t(`${slug}_title`)} actions={<Link href="/more" className="text-footnote font-medium text-primary">{t("back")}</Link>} />
      <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-3 md:px-6 lg:px-8">
        <CalculatorView slug={slug as CalcSlug} />
      </div>
    </AppShell>
  );
}
