import { NextRequest, NextResponse } from "next/server";
import { getShopify } from "@/lib/shopify/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop") ?? "";
  if (!shop) return NextResponse.redirect(new URL("/?error=missing-shop", req.url));

  let sanitizedShop: string;
  try {
    sanitizedShop = getShopify().utils.sanitizeShop(shop, true)!;
  } catch {
    return NextResponse.redirect(new URL("/?error=invalid-shop", req.url));
  }

  try {
    const { url, headers } = await getShopify().auth.begin({
      shop: sanitizedShop,
      callbackPath: "/standalone/callback",
      isOnline: false,
      rawRequest: req,
      rawResponse: { getHeaders: () => ({}), setHeader: () => {}, end: () => {} } as any,
    });

    const res = NextResponse.redirect(url);
    (headers as Headers).forEach((value, key) => res.headers.set(key, value));
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
