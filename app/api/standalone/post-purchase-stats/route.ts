import { NextRequest, NextResponse } from "next/server";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { getPostPurchaseOfferStats } from "@/lib/firebase/postPurchaseStatsStore";
import { listPostPurchaseOffers } from "@/lib/shopify/postPurchaseOfferStore";
import { COOKIE_NAME, verifyShop } from "@/lib/utils/standaloneSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  if (!session?.accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

  const offers = await listPostPurchaseOffers(shop, session.accessToken);
  const stats = await getPostPurchaseOfferStats(shop, offers.map((offer) => offer.id));

  const merged = stats.map((stat) => {
    const offer = offers.find((entry) => entry.id === stat.offerId);
    return {
      ...stat,
      name: offer?.name ?? "Post-purchase offer",
      productLabel: offer?.offerProduct?.title ?? "",
      triggerType: offer?.triggerType ?? "all_orders",
      discountPercent: offer?.discountPercent ?? 0,
    };
  });

  const totalViews = merged.reduce((sum, stat) => sum + stat.viewed, 0);
  const totalAccepted = merged.reduce((sum, stat) => sum + stat.accepted, 0);
  const totalRevenue = merged.reduce((sum, stat) => sum + stat.revenue, 0);

  return NextResponse.json({
    offers: merged,
    summary: {
      activeOffers: offers.length,
      totalViews,
      totalAccepted,
      totalRevenue,
      conversionRate: totalViews > 0 ? `${((totalAccepted / totalViews) * 100).toFixed(1)}%` : "—",
    },
  });
}
