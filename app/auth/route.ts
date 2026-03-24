import { NextRequest, NextResponse } from "next/server";
import { getShopify } from "@/lib/shopify/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /auth?shop=example.mygetShopify().com
 * Starts the Shopify OAuth flow — redirects to the Shopify permissions screen.
 */
export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop") ?? "";

  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  let sanitizedShop: string;
  try {
    sanitizedShop = getShopify().utils.sanitizeShop(shop, true)!;
  } catch {
    return NextResponse.json({ error: "Invalid shop domain" }, { status: 400 });
  }

  const { url, headers } = await getShopify().auth.begin({
    shop: sanitizedShop,
    callbackPath: "/auth/callback",
    isOnline: false,
    rawRequest: req,
    rawResponse: new Response(),
  });

  const res = NextResponse.redirect(url);
  (headers as Headers).forEach((value: string, key: string) => res.headers.set(key, value));
  return res;
}
