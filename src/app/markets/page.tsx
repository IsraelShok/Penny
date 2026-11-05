import { redirect } from "next/navigation";

// Markets now live at the bottom of Investments.
export default function MarketsPage() {
  redirect("/investments#markets");
}
