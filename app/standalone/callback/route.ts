import { NextRequest, NextResponse } from "next/server";
import { getShopify } from "@/lib/shopify/client";
import { saveShop } from "@/lib/firebase/shopStore";
import { signShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { session } = await getShopify().auth.callback({
      rawRequest: req,
      rawResponse: { getHeaders: () => ({}), setHeader: () => {}, end: () => {} } as any,
    });

    await saveShop(session.shop, {
      installedAt: new Date().toISOString(),
      uninstalledAt: null,
    });

    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.cookies.set(COOKIE_NAME, signShop(session.shop), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("[standalone/callback]", err);
    return NextResponse.redirect(new URL("/?error=auth-failed", req.url));
  }
}
