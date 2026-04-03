import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES =
  "read_orders,write_orders,read_products,write_products,read_themes,write_themes,read_customers,read_analytics,read_discounts,write_discounts,read_cart_transforms,write_cart_transforms,read_metaobjects,write_metaobjects,write_metaobject_definitions";

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

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = `${process.env.HOST}/auth/callback`;
  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_API_KEY}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 10,
    path: "/",
  };

  if (host || embedded === "1") {
    const html = buildTopLevelRedirectPage(authUrl);
    const iframeEscape = new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
    iframeEscape.cookies.set("shopify_oauth_state", state, cookieOptions);
    return iframeEscape;
  }

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("shopify_oauth_state", state, cookieOptions);
  return res;
}
