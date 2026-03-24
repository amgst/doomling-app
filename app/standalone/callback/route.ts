import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { saveShop } from "@/lib/firebase/shopStore";
import { signShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { Session } from "@shopify/shopify-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      return NextResponse.json({ step: "state", state, cookieState }, { status: 400 });
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
      return NextResponse.json({ step: "hmac", digest, hmac }, { status: 400 });
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
      const body = await tokenRes.text();
      return NextResponse.json({ step: "token", status: tokenRes.status, body }, { status: 400 });
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
      ["scope", "write_orders,read_products,read_customers,read_analytics"],
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
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return NextResponse.json({ step: "catch", message, stack }, { status: 500 });
  }
}
