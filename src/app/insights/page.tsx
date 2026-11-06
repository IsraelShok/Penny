import { redirect } from "next/navigation";

// Insights now live as tabs on the overview page.
export default function InsightsPage() {
  redirect("/overview?tab=ahead");
}
