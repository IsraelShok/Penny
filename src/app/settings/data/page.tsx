import { redirect } from "next/navigation";

// Import and data management now live on the accounts page.
export default function DataSettingsRedirect() {
  redirect("/settings/bank#import");
}
