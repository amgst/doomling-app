"use client";

import { useEffect, useState, useCallback } from "react";
import OrdersChart from "@/components/charts/OrdersChart";
import RevenueChart from "@/components/charts/RevenueChart";

interface DailyStat {
  date: string;
  count: number;
  revenue: number;
  currency: string;
}

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  currency: string;
  avgOrderValue: number;
  daily: DailyStat[];
}

const RANGES = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
];

const fmt = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

function StatCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: "10px",
      padding: "1.25rem 1.5rem",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#6d7175", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</p>
      <p style={{ margin: "0.4rem 0 0.25rem", fontSize: "1.75rem", fontWeight: 700, color: "#1a1a1a" }}>{value}</p>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#6d7175" }}>{sub}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [days, setDays] = useState("30");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/standalone/analytics?days=${days}`);
      if (res.status === 401) {
        window.location.href = "/";
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data.stats);
    } catch {
      setError("Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div>
      {/* Header */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #e4e5e7",
        padding: "0 2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "60px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: 32, height: 32,
            background: "#008060",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem" }}>U</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a1a" }}>Upsale</span>
        </div>
        <a
          href="/standalone/logout"
          style={{ fontSize: "0.85rem", color: "#6d7175", textDecoration: "none" }}
        >
          Sign out
        </a>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Dashboard</h1>
            <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>Store performance overview</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => setDays(r.value)}
                style={{
                  padding: "0.4rem 0.9rem",
                  borderRadius: "6px",
                  border: "1px solid",
                  borderColor: days === r.value ? "#008060" : "#d1d5db",
                  background: days === r.value ? "#008060" : "#fff",
                  color: days === r.value ? "#fff" : "#374151",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            background: "#fff4f4",
            border: "1px solid #ffd2d2",
            borderRadius: "8px",
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            color: "#c0392b",
            fontSize: "0.875rem",
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading…</div>
        ) : stats ? (
          <>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              <StatCard title="Total Orders" value={stats.totalOrders.toString()} sub={`Last ${days} days`} />
              <StatCard title="Total Revenue" value={fmt(stats.totalRevenue, stats.currency)} sub={`Last ${days} days`} />
              <StatCard title="Avg Order Value" value={fmt(stats.avgOrderValue, stats.currency)} sub={`Last ${days} days`} />
              <StatCard title="Daily Avg" value={(stats.totalOrders / parseInt(days)).toFixed(1)} sub="Orders per day" />
            </div>

            {/* Charts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ background: "#fff", borderRadius: "10px", padding: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <p style={{ margin: "0 0 1rem", fontWeight: 600, color: "#1a1a1a" }}>Orders Over Time</p>
                <OrdersChart data={stats.daily} />
              </div>
              <div style={{ background: "#fff", borderRadius: "10px", padding: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <p style={{ margin: "0 0 1rem", fontWeight: 600, color: "#1a1a1a" }}>Revenue Over Time</p>
                <RevenueChart data={stats.daily} currency={stats.currency} />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
