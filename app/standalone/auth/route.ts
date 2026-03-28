import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES = "write_orders,write_products,read_products,read_customers,read_analytics,write_discounts,read_discounts";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop") ?? "";

  if (!shop || !shop.endsWith(".myshopify.com")) {
    return NextResponse.redirect(new URL("/?error=invalid-shop", req.url));
  }

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = `${process.env.HOST}/standalone/callback`;
  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_API_KEY}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  return res;
}
