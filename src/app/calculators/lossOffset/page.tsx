import CalculatorPage from "../[slug]/page";

/** Static so the learn guide can link here; same view as /calculators/[slug]. */
export default function Page() {
  return CalculatorPage({ params: Promise.resolve({ slug: "lossOffset" }) } as PageProps<"/calculators/[slug]">);
}
