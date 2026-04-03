import { NextRequest, NextResponse } from "next/server";
import { getShopify } from "@/lib/shopify/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildTopLevelRedirectPage(url: string) {
  const safeUrl = JSON.stringify(url);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting…</title>
  </head>
  <body>
    <script>
      (function() {
        var target = ${safeUrl};
        if (window.top && window.top !== window.self) {
          window.open(target, "_top");
          return;
        }
        window.location.href = target;
      })();
    </script>
    <p>Redirecting to Shopify…</p>
  </body>
</html>`;
}

/**
 * GET /auth?shop=example.mygetShopify().com
 * Starts the Shopify OAuth flow — redirects to the Shopify permissions screen.
 */
export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop") ?? "";
  const host = req.nextUrl.searchParams.get("host") ?? "";
  const embedded = req.nextUrl.searchParams.get("embedded") ?? "";

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

  if (host || embedded === "1") {
    const html = buildTopLevelRedirectPage(url);
    const iframeEscape = new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
    (headers as Headers).forEach((value: string, key: string) => iframeEscape.headers.set(key, value));
    return iframeEscape;
  }

  return res;
}
