import { NextRequest, NextResponse } from "next/server";
import { getShopify } from "@/lib/shopify/client";
import { saveShop } from "@/lib/firebase/shopStore";
import { registerWebhooks } from "@/lib/shopify/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /auth/callback
 * Completes the OAuth exchange, stores the session in Firestore,
 * registers webhooks, then redirects into the embedded app.
 */
export async function GET(req: NextRequest) {
  try {
    const { session, headers } = await getShopify().auth.callback({
      rawRequest: req,
      rawResponse: { getHeaders: () => ({}), setHeader: () => {}, end: () => {} } as any,
    });

    // Persist shop metadata in Firestore
    await saveShop(session.shop, {
      installedAt: new Date().toISOString(),
      uninstalledAt: null,
    });

    // Register webhooks (non-blocking best-effort)
    await registerWebhooks(session).catch((err) =>
      console.warn("[auth/callback] Webhook registration error:", err)
    );

    // Redirect into the embedded app
    const host = req.nextUrl.searchParams.get("host") ?? "";
    const redirectUrl = `${process.env.HOST}/app/dashboard?shop=${session.shop}&host=${host}`;

    const res = NextResponse.redirect(redirectUrl);
    (headers as Headers).forEach((value: string, key: string) => res.headers.set(key, value));
    return res;
  } catch (err) {
    console.error("[auth/callback] Error:", err);
    const shop = req.nextUrl.searchParams.get("shop") ?? "";
    const host = req.nextUrl.searchParams.get("host") ?? "";
    const embedded = req.nextUrl.searchParams.get("embedded") ?? "";
    // Re-start OAuth on error
    const retryUrl = new URL(`${process.env.HOST}/auth`);
    retryUrl.searchParams.set("shop", shop);
    if (host) retryUrl.searchParams.set("host", host);
    if (embedded) retryUrl.searchParams.set("embedded", embedded);
    return NextResponse.redirect(retryUrl);
  }
}
