import { NextRequest, NextResponse } from "next/server";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { getShopUpsellRulesMetafield } from "@/lib/shopify/shopUpsellRulesMetafield";
import { ensureInstalledPublicShop } from "@/lib/utils/publicShopAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const productId = searchParams.get("product_id") ?? "";
  const { shop, errorResponse } = await ensureInstalledPublicShop(searchParams.get("shop"));

  if (errorResponse || !productId) {
    return NextResponse.json({ upsells: [] }, { status: errorResponse?.status, headers: CORS });
  }

  try {
    const session = await firestoreSessionStorage.loadSession(`offline_${shop!}`);
    if (!session?.accessToken) return NextResponse.json({ upsells: [] }, { headers: CORS });

    const rules = await getShopUpsellRulesMetafield(shop!, session.accessToken);
    const rule = rules.find((r) => String(r.triggerProductId) === String(productId));
    if (!rule) return NextResponse.json({ upsells: [] }, { headers: CORS });

    const upsells = (rule.upsellProducts || []).map((p) => ({
      ruleId: rule.id,
      productId: p.productId,
      title: p.title,
      image: p.image,
      handle: p.handle,
      originalPrice: p.price,
      price:
        p.discountPercent > 0
          ? (parseFloat(p.price) * (1 - p.discountPercent / 100)).toFixed(2)
          : p.price,
      discountPercent: p.discountPercent,
      message: rule.message,
    }));

    return NextResponse.json({ upsells }, { headers: CORS });
  } catch (err) {
    console.error("[api/upsell]", err);
    return NextResponse.json({ upsells: [] }, { headers: CORS });
  }
}
