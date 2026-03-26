"use client";

import { useRouter, usePathname } from "next/navigation";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "products", label: "Products" },
  { key: "upsells", label: "Upsells" },
  { key: "promotions", label: "Free Gift" },
  { key: "stats", label: "Statistics" },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function DashboardShell({ children, activeTab }: { children: React.ReactNode; activeTab?: TabKey }) {
  const router = useRouter();
  const pathname = usePathname();

  const tabFromPath = (pathname.split("/")[2] ?? "overview") as TabKey;
  const tab = activeTab ?? (TABS.some(t => t.key === tabFromPath) ? tabFromPath : "overview");

  return (
    <div style={{ minHeight: "100vh", background: "#f6f6f7", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Header */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e4e5e7",
        padding: "0 2rem", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: "60px",
        position: "sticky" as const, top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{ width: 32, height: 32, background: "#008060", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem" }}>U</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a1a" }}>Upsale</span>
        </div>
        <a href="/standalone/logout" style={{ fontSize: "0.85rem", color: "#6d7175", textDecoration: "none" }}>Sign out</a>
      </div>

      {/* Tab nav */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e4e5e7", padding: "0 2rem", display: "flex" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => router.push(`/dashboard/${t.key}`)} style={{
            padding: "0.875rem 1.25rem",
            border: "none",
            borderBottom: tab === t.key ? "2px solid #008060" : "2px solid transparent",
            background: "none",
            fontSize: "0.875rem",
            fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? "#008060" : "#6d7175",
            cursor: "pointer",
            marginBottom: "-1px",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        {children}
      </div>
    </div>
  );
}
