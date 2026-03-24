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

  try {
    const stats = await getOrderStats(shop, startDate, endDate);
    return NextResponse.json({ ok: true, stats, days });
  } catch (err) {
    console.error("[standalone/analytics]", err);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
