import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { saveShop } from "@/lib/firebase/shopStore";
import { signShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { Session } from "@shopify/shopify-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function oauthError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const shop = searchParams.get("shop") ?? "";
    const code = searchParams.get("code") ?? "";
    const state = searchParams.get("state") ?? "";
    const hmac = searchParams.get("hmac") ?? "";

    // Verify state matches cookie
    const cookieState = req.cookies.get("shopify_oauth_state")?.value;
    if (!state || state !== cookieState) {
      return oauthError("Invalid OAuth state");
    }

    // Verify HMAC signature
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key !== "hmac") params[key] = value;
    });
    const message = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    const digest = crypto
      .createHmac("sha256", process.env.SHOPIFY_API_SECRET!)
      .update(message)
      .digest("hex");
    if (digest !== hmac) {
      return oauthError("Invalid OAuth signature");
    }

    // Exchange code for access token
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
      console.error("[standalone/callback] Token exchange failed", {
        status: tokenRes.status,
        shop,
      });
      return oauthError("Token exchange failed");
    }
    const { access_token } = await tokenRes.json();

    // Store session so embedded app API calls work too
    const sessionId = `offline_${shop}`;
    const session = Session.fromPropertyArray([
      ["id", sessionId],
      ["shop", shop],
      ["state", state],
      ["isOnline", false],
      ["accessToken", access_token],
      ["scope", "write_orders,write_products,read_products,read_themes,write_themes,read_customers,read_analytics,write_discounts,read_discounts,read_cart_transforms,write_cart_transforms"],
    ]);
    await firestoreSessionStorage.storeSession(session);

    // Save shop metadata
    await saveShop(shop, { installedAt: new Date().toISOString(), uninstalledAt: null });

    // Set session cookie and redirect to dashboard
    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.cookies.set(COOKIE_NAME, await signShop(shop), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    res.cookies.delete("shopify_oauth_state");
    return res;
  } catch (err) {
    console.error("[standalone/callback] Unexpected error", err);
    return oauthError("Authentication failed", 500);
  }
}
