"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import DashboardShell from "@/components/DashboardShell";

const OverviewTab = dynamic(() => import("./tabs/OverviewTab"), {
  loading: () => <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading dashboard...</div>,
});
const ProductsTab = dynamic(() => import("./tabs/ProductsTab"), {
  loading: () => <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading products...</div>,
});
const CartLimitsTab = dynamic(() => import("./tabs/CartLimitsTab"), {
  loading: () => <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading cart limits...</div>,
});
const UpsellsTab = dynamic(() => import("./tabs/UpsellsTab"), {
  loading: () => <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading upsells...</div>,
});
const BuyXGetYTabPolaris = dynamic(() => import("./tabs/BuyXGetYTabPolaris"), {
  loading: () => <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading Buy X Get Y...</div>,
});
const BundleOffersTab = dynamic(() => import("./tabs/BundleOffersTab"), {
  loading: () => <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading bundle offers...</div>,
});
const GeoCountdownTab = dynamic(() => import("./tabs/GeoCountdownTab"), {
  loading: () => <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading geo countdown...</div>,
});
const LaunchpadTab = dynamic(() => import("./tabs/LaunchpadTab"), {
  loading: () => <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading theme scheduler...</div>,
});
const PostPurchaseTab = dynamic(() => import("./tabs/PostPurchaseTab"), {
  loading: () => <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading post-purchase...</div>,
});
const StatsTab = dynamic(() => import("./tabs/StatsTab"), {
  loading: () => <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading stats...</div>,
});

const VALID_TABS = [
  "overview",
  "products",
  "cartlimits",
  "upsells",
  "buyxgety",
  "bundles",
  "geocountdown",
  "themeswitcher",
  "postpurchase",
  "stats",
] as const;

type Tab = (typeof VALID_TABS)[number];

interface ShopInfo {
  shop: string;
  storeName: string;
  storeUrl: string;
  adminUrl: string;
}

export default function StandaloneDashboardApp({ activeTab }: { activeTab: Tab }) {
  const tab = VALID_TABS.includes(activeTab) ? activeTab : "overview";
  const [days, setDays] = useState("30");
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);

  useEffect(() => {
    fetch("/api/standalone/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.shop) setShopInfo(data);
      })
      .catch(() => {});
  }, []);

  return (
    <DashboardShell shopDomain={shopInfo?.shop} storeUrl={shopInfo?.storeUrl} adminUrl={shopInfo?.adminUrl} activeTab={tab}>
      {tab === "overview" && <OverviewTab days={days} setDays={setDays} storeName={shopInfo?.storeName} />}
      {tab === "products" && <ProductsTab storeUrl={shopInfo?.storeUrl} adminUrl={shopInfo?.adminUrl} />}
      {tab === "cartlimits" && <CartLimitsTab />}
      {tab === "upsells" && <UpsellsTab storeUrl={shopInfo?.storeUrl} />}
      {tab === "buyxgety" && <BuyXGetYTabPolaris />}
      {tab === "bundles" && <BundleOffersTab />}
      {tab === "geocountdown" && <GeoCountdownTab />}
      {tab === "themeswitcher" && <LaunchpadTab />}
      {tab === "postpurchase" && <PostPurchaseTab />}
      {tab === "stats" && <StatsTab />}
    </DashboardShell>
  );
}
