import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { getPromotion, savePromotion } from "@/lib/firebase/promotionStore";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getShop(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie ? await verifyShop(cookie) : null;
}

export async function GET(req: NextRequest) {
  const shop = await getShop(req);
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const promotion = await getPromotion(shop);
  return NextResponse.json({ promotion });
}

export async function POST(req: NextRequest) {
  const shop = await getShop(req);
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  // If variantId is missing but we have a product ID, fetch it from Shopify Admin API
  if (!body.giftVariantId && body.giftProductId) {
    try {
      const sessionId = `offline_${shop}`;
      const session = await firestoreSessionStorage.loadSession(sessionId);
      if (session?.accessToken) {
        const res = await fetch(
          `https://${shop}/admin/api/2024-01/products/${body.giftProductId}.json?fields=variants`,
          { headers: { "X-Shopify-Access-Token": session.accessToken } }
        );
        if (res.ok) {
          const data = await res.json();
          body.giftVariantId = String(data.product?.variants?.[0]?.id ?? "");
        }
      }
    } catch {}
  }

  await savePromotion(shop, body);
  return NextResponse.json({ ok: true });
}
