import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { ArticleView } from "@/components/learn/learn";
import { ARTICLES, articleBySlug, pick } from "@/content/learn";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export default async function Page(props: PageProps<"/learn/[slug]">) {
  const { slug } = await props.params;
  const article = articleBySlug(slug);
  if (!article) notFound();
  const locale = await getLocale();
  return (
    <AppShell>
      <PageHeader title={pick(article.title, locale)} />
      <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-3 md:px-6 lg:px-8">
        <ArticleView a={article} />
      </div>
    </AppShell>
  );
}
