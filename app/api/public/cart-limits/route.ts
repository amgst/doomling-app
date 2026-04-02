import { NextRequest, NextResponse } from "next/server";
import { getShop } from "@/lib/firebase/shopStore";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { getShopCartQuantityRulesMetafield } from "@/lib/shopify/shopCartQuantityRulesMetafield";

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
    const stored = await getShop(shop);
    const savedRules = stored?.settings?.cartQuantityRules;
    if (Array.isArray(savedRules)) {
      const rules = savedRules.filter((rule) => rule?.enabled !== false);
      return NextResponse.json({ rules }, { headers: CORS });
    }

    const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
    if (!session?.accessToken) return NextResponse.json({ rules: [] }, { headers: CORS });

    const rules = await getShopCartQuantityRulesMetafield(shop, session.accessToken);
    return NextResponse.json(
      { rules: rules.filter((rule) => rule?.enabled !== false) },
      { headers: CORS },
    );
  } catch (error) {
    console.error("[api/public/cart-limits]", error);
    return NextResponse.json({ rules: [] }, { headers: CORS });
  }
}
