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

  const shopPattern = /^[a-zA-Z0-9][a-zA-Z0-9-_]*\.(myshopify\.com|shopify\.com|myshopify\.io|shop\.dev)$/;
  if (!shopPattern.test(shop)) {
    return NextResponse.json({ error: "Invalid shop domain" }, { status: 400 });
  }

  if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET || !process.env.HOST) {
    return NextResponse.json(
      { error: "Missing Shopify app configuration. Check SHOPIFY_API_KEY, SHOPIFY_API_SECRET, and HOST." },
      { status: 500 },
    );
  }

  const sanitizedShop = shop;

  const { url, headers } = await getShopify().auth.begin({
    shop: sanitizedShop,
    callbackPath: "/auth/callback",
    isOnline: false,
    rawRequest: req,
    rawResponse: { getHeaders: () => ({}), setHeader: () => {}, end: () => {} } as any,
  });

  const res = NextResponse.redirect(url);
  (headers as Headers).forEach((value: string, key: string) => res.headers.set(key, value));
  return res;
}
