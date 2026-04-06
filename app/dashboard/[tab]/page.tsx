import { notFound } from "next/navigation";
import StandaloneDashboardApp from "@/components/dashboard/StandaloneDashboardApp";

const VALID_TABS = [
  "overview",
  "products",
  "cartlimits",
  "upsells",
  "buyxgety",
  "bundles",
  "geocountdown",
  "customcursor",
  "themeswitcher",
  "postpurchase",
  "stats",
] as const;

type Tab = (typeof VALID_TABS)[number];

export default async function DashboardTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;

  if (!VALID_TABS.includes(tab as Tab)) {
    notFound();
  }

  return <StandaloneDashboardApp activeTab={tab as Tab} />;
}
