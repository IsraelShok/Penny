import { getLocale, getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";

/** Required by the Equal Rights for Persons with Disabilities regulations. The owner fills in CONTACT. */
const CONTACT = {
  name: "", // TODO(owner): accessibility coordinator's name
  email: "", // TODO(owner): accessibility contact email
  phone: "", // TODO(owner): accessibility contact phone
};
const REVIEWED = new Date("2026-11-14T12:00:00Z");

const DONE = ["done1", "done2", "done3", "done4", "done5", "done6", "done7"] as const;
const LIMITS = ["limits1", "limits2", "limits3", "limits4"] as const;

export default async function AccessibilityStatementPage() {
  const t = await getTranslations("a11y.st");
  const locale = await getLocale();
  const section = "rounded-2xl bg-card p-6";
  const h2 = "text-title font-semibold";
  const todo = <span className="rounded bg-muted px-1.5 py-0.5 font-medium">TODO · {t("todo")}</span>;
  const date = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-IL", { dateStyle: "long", timeZone: "Asia/Jerusalem" }).format(REVIEWED);
  return (
    <AppShell>
      <PageHeader title={t("title")} />
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-8 pt-3 md:px-6 lg:px-8">
        <p className="text-base">{t("intro")}</p>

        <section className={section} aria-labelledby="a11y-standard">
          <h2 id="a11y-standard" className={h2}>{t("standardTitle")}</h2>
          <p className="mt-3 text-base">{t("standardBody")}</p>
        </section>

        <section className={section} aria-labelledby="a11y-done">
          <h2 id="a11y-done" className={h2}>{t("doneTitle")}</h2>
          <ul className="mt-3 list-disc space-y-2 ps-5 text-base">{DONE.map((k) => <li key={k}>{t(k)}</li>)}</ul>
        </section>

        <section className={section} aria-labelledby="a11y-menu">
          <h2 id="a11y-menu" className={h2}>{t("menuTitle")}</h2>
          <p className="mt-3 text-base">{t("menuBody")}</p>
        </section>

        <section className={section} aria-labelledby="a11y-limits">
          <h2 id="a11y-limits" className={h2}>{t("limitsTitle")}</h2>
          <ul className="mt-3 list-disc space-y-2 ps-5 text-base">{LIMITS.map((k) => <li key={k}>{t(k)}</li>)}</ul>
        </section>

        <section className={section} aria-labelledby="a11y-support">
          <h2 id="a11y-support" className={h2}>{t("supportTitle")}</h2>
          <p className="mt-3 text-base">{t("supportBody")}</p>
        </section>

        <section className={section} aria-labelledby="a11y-contact">
          <h2 id="a11y-contact" className={h2}>{t("contactTitle")}</h2>
          <p className="mt-3 text-base">{t("contactBody")}</p>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
            <dt className="font-semibold">{t("contactName")}</dt>
            <dd>{CONTACT.name || todo}</dd>
            <dt className="font-semibold">{t("contactEmail")}</dt>
            <dd>{CONTACT.email ? <a href={`mailto:${CONTACT.email}`} dir="ltr" className="text-primary underline underline-offset-4">{CONTACT.email}</a> : todo}</dd>
            <dt className="font-semibold">{t("contactPhone")}</dt>
            <dd>{CONTACT.phone ? <a href={`tel:${CONTACT.phone}`} dir="ltr" className="text-primary underline underline-offset-4">{CONTACT.phone}</a> : todo}</dd>
          </dl>
        </section>

        <p className="text-sm text-muted-foreground">{t("reviewed", { date })}</p>
      </div>
    </AppShell>
  );
}
