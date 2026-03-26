"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";

interface DailyStat { date: string; views: number; clicks: number; added: number; }
interface UpsellProduct { title: string; image: string; price: string; discountPercent: number; }
interface Rule {
  id: string;
  triggerProductTitle: string;
  upsellProducts: UpsellProduct[];
  message: string;
}
interface Stats {
  totalViews: number;
  totalClicks: number;
  totalAdded: number;
  ctr: string;
  convRate: string;
  daily: DailyStat[];
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [rule, setRule] = useState<Rule | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/standalone/stats/rule?id=${id}`)
      .then(async r => {
        if (r.status === 401) { window.location.href = "/"; throw new Error("unauth"); }
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed to load");
        return d;
      })
      .then(d => { setRule(d.rule); setStats(d.stats); })
      .catch(e => { if (e.message !== "unauth") setError(e.message); })
      .finally(() => setLoading(false));
  }, [id]);

  const card: React.CSSProperties = {
    background: "#fff", borderRadius: "10px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "1.25rem",
  };
  const th: React.CSSProperties = {
    padding: "0.65rem 1rem", textAlign: "left", fontSize: "0.78rem",
    fontWeight: 600, color: "#6d7175", textTransform: "uppercase",
    borderBottom: "1px solid #e4e5e7",
  };
  const td: React.CSSProperties = {
    padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#1a1a1a",
    borderBottom: "1px solid #f1f1f1",
  };

  if (loading) return (
    <DashboardShell activeTab="upsells">
      <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading…</div>
    </DashboardShell>
  );

  if (error || !rule || !stats) return (
    <DashboardShell activeTab="upsells">
      <button onClick={() => router.back()} style={{ marginBottom: "1rem", background: "none", border: "none", color: "#008060", fontSize: "0.875rem", cursor: "pointer", padding: 0 }}>
        ← Back
      </button>
      <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "1rem", color: "#c0392b" }}>
        {error ?? "Campaign not found."}
      </div>
    </DashboardShell>
  );

  const statCards = [
    { label: "Total Views", value: stats.totalViews, sub: "Widget impressions" },
    { label: "Clicks", value: stats.totalClicks, sub: "Add to cart clicked" },
    { label: "Added", value: stats.totalAdded, sub: "Successfully added" },
    { label: "CTR", value: stats.ctr, sub: "Click-through rate" },
    { label: "Conversion", value: stats.convRate, sub: "Clicks → Added" },
  ];

  return (
    <DashboardShell activeTab="upsells">
      {/* Back + heading */}
      <button
        onClick={() => router.push("/dashboard/upsells")}
        style={{ background: "none", border: "none", color: "#008060", fontSize: "0.875rem", cursor: "pointer", padding: 0, marginBottom: "1.25rem" }}
      >
        ← Back to Upsells
      </button>

      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>
          {rule.triggerProductTitle} → {rule.upsellProducts.length} suggestion{rule.upsellProducts.length !== 1 ? "s" : ""}
        </h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>Campaign performance</p>
      </div>

      {/* Campaign info card */}
      <div style={{ ...card, marginBottom: "1.25rem" }}>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "#6d7175" }}>{rule.message}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          {rule.upsellProducts.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.85rem", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e4e5e7" }}>
              {p.image && <img src={p.image} alt={p.title} style={{ width: 40, height: 40, borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />}
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: "0.85rem", color: "#1a1a1a" }}>{p.title}</p>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#008060", fontWeight: 600 }}>
                  {p.discountPercent > 0 ? `${p.discountPercent}% OFF` : `$${p.price}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
        {statCards.map(c => (
          <div key={c.label} style={{ ...card, padding: "1rem 1.1rem" }}>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "#6d7175", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.label}</p>
            <p style={{ margin: "0.25rem 0 0.15rem", fontSize: "1.6rem", fontWeight: 700, color: "#1a1a1a" }}>{c.value}</p>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "#6d7175" }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Daily breakdown */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid #e4e5e7" }}>
          <p style={{ margin: 0, fontWeight: 600, color: "#1a1a1a", fontSize: "0.9rem" }}>Daily Breakdown</p>
        </div>
        {stats.daily.length === 0 ? (
          <p style={{ padding: "2rem", textAlign: "center", color: "#6d7175", margin: 0 }}>
            No data yet — stats appear once the widget gets impressions.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Date</th>
                <th style={{ ...th, textAlign: "center" as const }}>Views</th>
                <th style={{ ...th, textAlign: "center" as const }}>Clicks</th>
                <th style={{ ...th, textAlign: "center" as const }}>Added</th>
                <th style={{ ...th, textAlign: "center" as const }}>CTR</th>
              </tr>
            </thead>
            <tbody>
              {[...stats.daily].reverse().map(d => (
                <tr key={d.date}>
                  <td style={td}>{d.date}</td>
                  <td style={{ ...td, textAlign: "center" as const }}>{d.views}</td>
                  <td style={{ ...td, textAlign: "center" as const }}>{d.clicks}</td>
                  <td style={{ ...td, textAlign: "center" as const }}>{d.added}</td>
                  <td style={{ ...td, textAlign: "center" as const }}>
                    <span style={{ background: "#f1f1f1", padding: "0.15rem 0.5rem", borderRadius: "20px", fontSize: "0.78rem" }}>
                      {d.views > 0 ? ((d.clicks / d.views) * 100).toFixed(1) + "%" : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardShell>
  );
}
