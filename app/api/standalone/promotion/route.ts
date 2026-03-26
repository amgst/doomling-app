import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { getPromotion, savePromotion, type PromotionTier } from "@/lib/firebase/promotionStore";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getShop(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie ? await verifyShop(cookie) : null;
}

async function fetchVariantId(shop: string, token: string, productId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://${shop}/admin/api/2024-01/products/${productId}.json?fields=variants`,
      { headers: { "X-Shopify-Access-Token": token } }
    );
    if (res.ok) {
      const data = await res.json();
      return String(data.product?.variants?.[0]?.id ?? "");
    }
  } catch {}
  return "";
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

  const sessionId = `offline_${shop}`;
  const session = await firestoreSessionStorage.loadSession(sessionId);

  // Resolve variantIds for any tier missing them
  if (session?.accessToken && Array.isArray(body.tiers)) {
    for (const tier of body.tiers as PromotionTier[]) {
      if (!tier.giftVariantId && tier.giftProductId) {
        tier.giftVariantId = await fetchVariantId(shop, session.accessToken, tier.giftProductId);
      }
    }
  }

  await savePromotion(shop, body);

  return NextResponse.json({ ok: true, syncStatus: { status: "saved" } });
}
