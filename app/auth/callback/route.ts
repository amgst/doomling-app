import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Session } from "@shopify/shopify-api";
import { saveShop } from "@/lib/firebase/shopStore";
import { registerWebhooks } from "@/lib/shopify/webhooks";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES =
  "read_orders,write_orders,read_products,write_products,read_themes,write_themes,read_customers,read_analytics,read_discounts,write_discounts,read_cart_transforms,write_cart_transforms,read_metaobjects,write_metaobjects,write_metaobject_definitions";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const shop = searchParams.get("shop") ?? "";
    const code = searchParams.get("code") ?? "";
    const state = searchParams.get("state") ?? "";
    const hmac = searchParams.get("hmac") ?? "";

    const cookieState = req.cookies.get("shopify_oauth_state")?.value;
    if (!state || state !== cookieState) {
      return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
    }

    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key !== "hmac") params[key] = value;
    });
    const message = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&");
    const digest = crypto.createHmac("sha256", process.env.SHOPIFY_API_SECRET!).update(message).digest("hex");
    if (digest !== hmac) {
      return NextResponse.json({ error: "Invalid OAuth signature" }, { status: 400 });
    }

    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      return NextResponse.json({ error: `Token exchange failed: ${body}` }, { status: 400 });
    }

    const { access_token } = await tokenRes.json();

    const session = Session.fromPropertyArray([
      ["id", `offline_${shop}`],
      ["shop", shop],
      ["state", state],
      ["isOnline", false],
      ["accessToken", access_token],
      ["scope", SCOPES],
    ]);
    await firestoreSessionStorage.storeSession(session);

    await saveShop(shop, {
      installedAt: new Date().toISOString(),
      uninstalledAt: null,
    });

    await registerWebhooks(session).catch((err) =>
      console.warn("[auth/callback] Webhook registration error:", err),
    );

    const host = req.nextUrl.searchParams.get("host") ?? "";
    const redirectUrl = `${process.env.HOST}/app/dashboard?shop=${shop}&host=${host}`;

    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete("shopify_oauth_state");
    return res;
  } catch (err) {
    console.error("[auth/callback] Error:", err);
    const shop = req.nextUrl.searchParams.get("shop") ?? "";
    const host = req.nextUrl.searchParams.get("host") ?? "";
    const embedded = req.nextUrl.searchParams.get("embedded") ?? "";
    const retryUrl = new URL(`${process.env.HOST}/auth`);
    retryUrl.searchParams.set("shop", shop);
    if (host) retryUrl.searchParams.set("host", host);
    if (embedded) retryUrl.searchParams.set("embedded", embedded);
    return NextResponse.redirect(retryUrl);
  }
}
