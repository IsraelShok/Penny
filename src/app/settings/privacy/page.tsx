import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SectionShell, SettingCard } from "@/components/settings/section-shell";
import { PrivacyModeSwitch } from "@/components/settings/privacy-mode-switch";
import { Button } from "@/components/ui/button";
import { dataDir } from "@/server/lib/data-dir";

const STORED = ["storedTransactions", "storedCredentials", "storedKey", "storedSettings"] as const;
const LEAVES = ["leavesBanks", "leavesAi", "leavesTelegram", "leavesUpdate"] as const;

export default async function PrivacySettingsPage() {
  const t = await getTranslations("settings.privacy");
  return (
    <SectionShell title={t("title")} description={t("description")}>
      <SettingCard title={t("modeTitle")} description={t("modeDescription")}>
        <PrivacyModeSwitch />
      </SettingCard>

      <SettingCard title={t("storedTitle")} description={t("storedDescription")}>
        <p className="mb-3 text-sm">
          {t("whereLabel")}{" "}
          <code dir="ltr" className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {dataDir()}
          </code>
        </p>
        <ul className="list-disc space-y-1.5 ps-5 text-sm">
          {STORED.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </SettingCard>

      <SettingCard title={t("leavesTitle")} description={t("leavesDescription")}>
        <ul className="list-disc space-y-1.5 ps-5 text-sm">
          {LEAVES.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </SettingCard>

      <SettingCard title={t("protectTitle")}>
        <p className="text-sm">{t("protectBody")}</p>
      </SettingCard>

      <SettingCard title={t("deleteTitle")} description={t("deleteDescription")}>
        <Button variant="outline" nativeButton={false} render={<Link href="/settings/data" />}>
          {t("deleteCta")}
        </Button>
      </SettingCard>
    </SectionShell>
  );
}
