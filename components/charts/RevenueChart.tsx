"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DailyStat {
  date: string;
  count: number;
  revenue: number;
}

interface RevenueChartProps {
  data: DailyStat[];
  currency?: string;
}

export default function RevenueChart({ data, currency = "USD" }: RevenueChartProps) {
  if (!data.length) {
    return <p style={{ color: "#8c9196", textAlign: "center", padding: "1rem" }}>No data available</p>;
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e5e7" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "#8c9196" }}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#8c9196" }}
          tickFormatter={(v: number) => fmt(v)}
        />
        <Tooltip
          formatter={(value: number) => [fmt(value), "Revenue"]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Bar dataKey="revenue" fill="#008060" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
