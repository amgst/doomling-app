"use client";

import {
  LineChart,
  Line,
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

interface OrdersChartProps {
  data: DailyStat[];
}

export default function OrdersChart({ data }: OrdersChartProps) {
  if (!data.length) {
    return <p style={{ color: "#8c9196", textAlign: "center", padding: "1rem" }}>No data available</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e5e7" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "#8c9196" }}
          tickFormatter={(v: string) => v.slice(5)} // show "MM-DD"
        />
        <YAxis tick={{ fontSize: 12, fill: "#8c9196" }} allowDecimals={false} />
        <Tooltip
          formatter={(value: number) => [value, "Orders"]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#008060"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
