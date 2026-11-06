import { AppShell } from "@/components/layout/app-shell";
import { HomePage } from "@/components/home/home-page";
import { ProfileGate } from "@/components/profiles/profile-gate";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <AppShell>
      <ProfileGate />
      <HomePage />
    </AppShell>
  );
}
