import { NextRequest, NextResponse } from "next/server";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { getShopCartQuantityRulesMetafield } from "@/lib/shopify/shopCartQuantityRulesMetafield";
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
  const { shop, stored, errorResponse } = await ensureInstalledPublicShop(req.nextUrl.searchParams.get("shop"));
  if (errorResponse) {
    return NextResponse.json({ rules: [] }, { status: errorResponse.status, headers: CORS });
  }

  try {
    const savedRules = stored?.settings?.cartQuantityRules;
    if (Array.isArray(savedRules)) {
      const rules = savedRules.filter((rule) => rule?.enabled !== false);
      return NextResponse.json({ rules }, { headers: CORS });
    }

    const session = await firestoreSessionStorage.loadSession(`offline_${shop!}`);
    if (!session?.accessToken) return NextResponse.json({ rules: [] }, { headers: CORS });

    const rules = await getShopCartQuantityRulesMetafield(shop!, session.accessToken);
    return NextResponse.json(
      { rules: rules.filter((rule) => rule?.enabled !== false) },
      { headers: CORS },
    );
  } catch (error) {
    console.error("[api/public/cart-limits]", error);
    return NextResponse.json({ rules: [] }, { headers: CORS });
  }
}
