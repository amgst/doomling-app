import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { getUpsell } from "@/lib/firebase/upsellStore";
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

  const [rule, snap] = await Promise.all([
    getUpsell(shop, ruleId),
    getDocs(query(
      collection(getDb(), "upsell_stats", shop, "rules", ruleId, "days"),
      orderBy("__name__")
    )),
  ]);

  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let totalViews = 0, totalClicks = 0, totalAdded = 0;
  const daily = snap.docs.map(d => {
    const data = d.data();
    const views = (data.view as number) || 0;
    const clicks = (data.click as number) || 0;
    const added = (data.added as number) || 0;
    totalViews += views;
    totalClicks += clicks;
    totalAdded += added;
    return { date: d.id, views, clicks, added };
  });

  return NextResponse.json({
    rule,
    stats: {
      totalViews,
      totalClicks,
      totalAdded,
      ctr: totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) + "%" : "—",
      convRate: totalClicks > 0 ? ((totalAdded / totalClicks) * 100).toFixed(1) + "%" : "—",
      daily,
    },
  });
}
