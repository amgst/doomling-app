import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { getOrderStats, buildDateRange } from "@/lib/firebase/analyticsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const daysParam = req.nextUrl.searchParams.get("days") ?? "30";
  const days = Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 365);

  const { startDate, endDate } = buildDateRange(days);

  // Previous period: same length, immediately before current period
  const prevEndDate = new Date();
  prevEndDate.setDate(prevEndDate.getDate() - days);
  const prevStartDate = new Date();
  prevStartDate.setDate(prevStartDate.getDate() - days * 2 + 1);
  const prevStart = prevStartDate.toISOString().slice(0, 10);
  const prevEnd = prevEndDate.toISOString().slice(0, 10);

  try {
    const [stats, prevStats] = await Promise.all([
      getOrderStats(shop, startDate, endDate),
      getOrderStats(shop, prevStart, prevEnd),
    ]);
    return NextResponse.json({
      ok: true,
      stats: {
        ...stats,
        prevTotalOrders: prevStats.totalOrders,
        prevTotalRevenue: prevStats.totalRevenue,
        prevUpsaleRevenue: prevStats.totalUpsaleRevenue,
        prevAvgOrderValue: prevStats.avgOrderValue,
      },
      days,
    });
  } catch (err) {
    console.error("[standalone/analytics]", err);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
