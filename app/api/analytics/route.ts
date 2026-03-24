import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/utils/verifyRequest";
import { getOrderStats, buildDateRange } from "@/lib/firebase/analyticsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/analytics?days=30
 * Returns order statistics for the authenticated shop.
 * Requires a valid App Bridge session token in the Authorization header.
 */
export async function GET(req: NextRequest) {
  const { shop, errorResponse } = await verifyRequest(req);
  if (errorResponse) return errorResponse;

  const daysParam = req.nextUrl.searchParams.get("days") ?? "30";
  const days = Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 365);

  const { startDate, endDate } = buildDateRange(days);

  try {
    const stats = await getOrderStats(shop!, startDate, endDate);
    return NextResponse.json({ ok: true, stats, startDate, endDate, days });
  } catch (err) {
    console.error("[api/analytics] Error fetching stats:", err);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
