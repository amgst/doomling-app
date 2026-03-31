import { NextRequest, NextResponse } from "next/server";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { getShopBxgyRulesMetafield } from "@/lib/shopify/shopBxgyRulesMetafield";

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
  const shop = req.nextUrl.searchParams.get("shop") ?? "";
  if (!shop) {
    return NextResponse.json({ rules: [] }, { headers: CORS });
  }

  try {
    const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
    if (!session?.accessToken) return NextResponse.json({ rules: [] }, { headers: CORS });

    const rules = await getShopBxgyRulesMetafield(shop, session.accessToken);
    const simplified = rules
      .filter((rule) => rule.enabled && rule.autoAdd && rule.buyProducts.length > 0 && rule.giftProduct?.variantId)
      .map((rule) => ({
        ruleId: rule.id,
        name: rule.name,
        message: rule.message,
        buyQuantity: rule.buyQuantity,
        giftQuantity: rule.giftQuantity,
        priority: rule.priority,
        buyVariantIds: rule.buyProducts.map((product) => String(product.variantId)),
        giftVariantId: String(rule.giftProduct?.variantId ?? ""),
        giftTitle: String(rule.giftProduct?.title ?? ""),
        giftImage: String(rule.giftProduct?.image ?? ""),
      }))
      .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

    return NextResponse.json({ rules: simplified }, { headers: CORS });
  } catch (error) {
    console.error("[api/public/gift-rules]", error);
    return NextResponse.json({ rules: [] }, { headers: CORS });
  }
}
