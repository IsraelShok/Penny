import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import {
  SettingsMobileNav,
} from "@/components/settings/settings-sidebar";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("settings");
  return (
    <AppShell>
      <PageHeader title={t("pageTitle")} largeTitle={false} />
      <div className="flex min-h-[calc(100vh-4rem)] flex-1">
        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-[720px] px-4 pb-8 pt-3 md:px-8">
            <SettingsMobileNav />
            {children}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
