import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { getUpsellRule } from "@/lib/shopify/upsellRuleStore";
import { getDb } from "@/lib/firebase/admin";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ruleId = req.nextUrl.searchParams.get("id");
  if (!ruleId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  if (!session?.accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

  const rule = await getUpsellRule(shop, session.accessToken, ruleId);
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const snap = await getDocs(query(
    collection(getDb(), "upsell_stats", shop, "rules", ruleId, "days"),
    orderBy("__name__")
  ));

  let totalViews = 0;
  let totalClicks = 0;
  let totalAdded = 0;
  let totalOrders = 0;
  let totalUnits = 0;
  let totalRevenue = 0;

  const daily = snap.docs.map((d) => {
    const data = d.data();
    const views = (data.view as number) || 0;
    const clicks = (data.click as number) || 0;
    const added = (data.added as number) || 0;
    const orders = (data.orders as number) || 0;
    const units = (data.units as number) || 0;
    const revenue = (data.revenue as number) || 0;

    totalViews += views;
    totalClicks += clicks;
    totalAdded += added;
    totalOrders += orders;
    totalUnits += units;
    totalRevenue += revenue;

    return { date: d.id, views, clicks, added, orders, units, revenue };
  });

  return NextResponse.json({
    rule,
    stats: {
      totalViews,
      totalClicks,
      totalAdded,
      totalOrders,
      totalUnits,
      totalRevenue,
      ctr: totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) + "%" : "-",
      convRate: totalClicks > 0 ? ((totalAdded / totalClicks) * 100).toFixed(1) + "%" : "-",
      addRate: totalViews > 0 ? ((totalAdded / totalViews) * 100).toFixed(1) + "%" : "-",
      revenuePerView: totalViews > 0 ? totalRevenue / totalViews : 0,
      revenuePerClick: totalClicks > 0 ? totalRevenue / totalClicks : 0,
      revenuePerOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      daily,
    },
  });
}
