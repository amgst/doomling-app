"use client";

import { useRouter, usePathname } from "next/navigation";

const TABS = [
  {
    key: "overview",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    key: "stats",
    label: "Statistics",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    key: "products",
    label: "Products",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    ),
  },
  {
    key: "upsells",
    label: "Upsells",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
  {
    key: "buyxgety",
    label: "Buy X Get Y",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 7h10" />
        <path d="M7 12h5" />
        <path d="M17 12l4 4" />
        <path d="M21 12l-4 4" />
        <path d="M8 17h3" />
      </svg>
    ),
  },
  {
    key: "bundles",
    label: "Bundle Offers",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="7" width="7" height="13" rx="1" />
        <rect x="14" y="4" width="7" height="16" rx="1" />
        <path d="M6 11h1" />
        <path d="M17 8h1" />
      </svg>
    ),
  },
  {
    key: "cartlimits",
    label: "Cart Limits",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5h6" />
        <path d="M7 3h10v4H7z" />
        <path d="M6 9h12l-1 11H7L6 9z" />
        <path d="M10 13h4" />
      </svg>
    ),
  },
  {
    key: "postpurchase",
    label: "Post-Purchase",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    key: "geocountdown",
    label: "Geo Countdown",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    key: "themeswitcher",
    label: "Theme Scheduler",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16" />
        <path d="M4 12h10" />
        <path d="M14 17h6" />
        <path d="M7 5l-3 2 3 2" />
        <path d="M17 15l3 2-3 2" />
      </svg>
    ),
  },
] as const;

const NAV_GROUPS: { label: string; keys: Array<typeof TABS[number]["key"]> }[] = [
  { label: "Analytics", keys: ["overview", "stats"] },
  { label: "Features", keys: ["products", "upsells", "buyxgety", "bundles", "cartlimits", "postpurchase", "geocountdown"] },
  { label: "Tools", keys: ["themeswitcher"] },
];

type TabKey = typeof TABS[number]["key"];

const LOGO = "https://www.doomlings.com/cdn/shop/files/Doomlings_Logo_FullColor_Outline_440x.png?v=1741365053";

export default function DashboardShell({
  children,
  activeTab,
  shopDomain,
  storeUrl,
  adminUrl,
}: {
  children: React.ReactNode;
  activeTab?: TabKey;
  shopDomain?: string;
  storeUrl?: string;
  adminUrl?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const tabFromPath = (pathname.split("/")[2] ?? "overview") as TabKey;
  const tab = activeTab ?? (TABS.some(t => t.key === tabFromPath) ? tabFromPath : "overview");

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      background: "#f3f4f6",
    }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 230,
        minWidth: 230,
        background: "#fff",
        borderRight: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        position: "sticky" as const,
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}>
        {/* Logo */}
        <div style={{
          padding: "1.5rem 1.25rem 1rem",
          borderBottom: "1px solid #f3f4f6",
        }}>
          <img
            src={LOGO}
            alt="Doomlings"
            style={{ width: "100%", maxWidth: 150, display: "block" }}
          />
        </div>

        {/* Store badge */}
        {shopDomain && (
          <a
            href={storeUrl ?? `https://${shopDomain}`}
            target="_blank"
            rel="noreferrer"
            title="Open online store"
            style={{
              margin: "0.75rem 1rem 0",
              padding: "0.45rem 0.75rem",
              background: "#f9fafb",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "0.78rem",
              color: "#374151",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              overflow: "hidden",
              textDecoration: "none",
              cursor: "pointer",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")}
            onMouseLeave={e => (e.currentTarget.style.background = "#f9fafb")}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              {shopDomain.replace(".myshopify.com", "")}
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0.75rem 0.75rem" }}>
          {NAV_GROUPS.map((group, gi) => {
            const groupTabs = TABS.filter(t => (group.keys as readonly string[]).includes(t.key));
            return (
              <div key={group.label} style={{ marginBottom: gi < NAV_GROUPS.length - 1 ? "1rem" : 0 }}>
                <p style={{
                  margin: "0 0 0.3rem 0.5rem",
                  fontSize: "0.67rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                  color: "#9ca3af",
                }}>{group.label}</p>
                {groupTabs.map(t => {
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => router.push(`/dashboard/${t.key}`)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.65rem",
                        padding: "0.55rem 0.75rem",
                        paddingLeft: active ? "calc(0.75rem - 3px)" : "0.75rem",
                        marginBottom: "0.1rem",
                        borderRadius: "8px",
                        border: "none",
                        borderLeft: active ? "3px solid #008060" : "3px solid transparent",
                        background: active ? "#ecfdf5" : "transparent",
                        color: active ? "#065f46" : "#4b5563",
                        fontWeight: active ? 600 : 400,
                        fontSize: "0.875rem",
                        cursor: "pointer",
                        textAlign: "left" as const,
                        transition: "background 0.15s, color 0.15s",
                      }}
                      onMouseEnter={e => {
                        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb";
                      }}
                      onMouseLeave={e => {
                        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      }}
                    >
                      <span style={{ flexShrink: 0, color: active ? "#008060" : "currentColor", opacity: active ? 1 : 0.55 }}>{t.icon}</span>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Sign out */}
        <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid #f3f4f6" }}>
          <a
            href="/standalone/logout"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.82rem",
              color: "#9ca3af",
              textDecoration: "none",
              padding: "0.4rem 0.5rem",
              borderRadius: "6px",
              transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#374151")}
            onMouseLeave={e => (e.currentTarget.style.color = "#9ca3af")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </a>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>
        {/* Top bar */}
        <div style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "0 2rem",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky" as const,
          top: 0,
          zIndex: 10,
        }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "0.95rem", color: "#111827" }}>
            {TABS.find(t => t.key === tab)?.label ?? "Dashboard"}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {adminUrl && (
              <a href={adminUrl} target="_blank" rel="noreferrer" style={{
                fontSize: "0.78rem", color: "#6b7280", textDecoration: "none",
                display: "flex", alignItems: "center", gap: "0.3rem",
              }}
                onMouseEnter={e => (e.currentTarget.style.color = "#111827")}
                onMouseLeave={e => (e.currentTarget.style.color = "#6b7280")}
              >
                Shopify Admin
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            )}
            {storeUrl && (
              <a href={storeUrl} target="_blank" rel="noreferrer" style={{
                fontSize: "0.78rem", color: "#6b7280", textDecoration: "none",
                display: "flex", alignItems: "center", gap: "0.3rem",
              }}
                onMouseEnter={e => (e.currentTarget.style.color = "#111827")}
                onMouseLeave={e => (e.currentTarget.style.color = "#6b7280")}
              >
                Online Store
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* Page content */}
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "2rem 2rem" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
