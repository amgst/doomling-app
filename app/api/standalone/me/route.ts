import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeName = shop.replace(".myshopify.com", "");
  return NextResponse.json({
    shop,
    storeName,
    storeUrl: `https://${shop}`,
    adminUrl: `https://admin.shopify.com/store/${storeName}`,
  });
}
