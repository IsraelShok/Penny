import { redirect } from "next/navigation";

// Rules now live under Settings.
export default function RulesPage() {
  redirect("/settings/rules");
}
