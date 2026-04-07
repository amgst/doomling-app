import { NextRequest, NextResponse } from "next/server";
import { getShopify } from "@/lib/shopify/client";
import { signShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/standalone/session
 *
 * Exchanges an App Bridge session token (JWT) for the standalone HMAC session
 * cookie. Called by EmbeddedSessionBridge on mount so that the embedded app
 * can share the same cookie-authenticated API routes used by the standalone
 * dashboard (e.g. /api/standalone/bxgy/*).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
  }

  const sessionToken = authHeader.slice(7);
  const shopify = getShopify();

  try {
    const payload = await shopify.session.decodeSessionToken(sessionToken);
    const shop = (payload.dest as string).replace("https://", "");

    const cookieValue = await signShop(shop);

    const response = NextResponse.json({ ok: true, shop });
    response.cookies.set(COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: true,
      sameSite: "none", // required for iframe (embedded app) context
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[session] JWT verification failed:", err);
    return NextResponse.json({ error: "Invalid session token" }, { status: 401 });
  }
}
