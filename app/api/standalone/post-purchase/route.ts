import { NextRequest, NextResponse } from "next/server";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { COOKIE_NAME, verifyShop } from "@/lib/utils/standaloneSession";
import { listPostPurchaseOffers, upsertPostPurchaseOffer } from "@/lib/shopify/postPurchaseOfferStore";
import { setShopPostPurchaseOffersMetafield } from "@/lib/shopify/shopPostPurchaseOffersMetafield";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getShop(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie ? await verifyShop(cookie) : null;
}

async function getAccessToken(shop: string) {
  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  return session?.accessToken ?? null;
}

async function syncCompiledState(shop: string, accessToken: string) {
  const offers = await listPostPurchaseOffers(shop, accessToken);
  await setShopPostPurchaseOffersMetafield(shop, accessToken, offers);
  return offers;
}

export async function GET(req: NextRequest) {
  try {
    const shop = await getShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessToken = await getAccessToken(shop);
    if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

    const offers = await listPostPurchaseOffers(shop, accessToken);
    return NextResponse.json({ offers });
  } catch (error) {
    console.error("[post-purchase] GET failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load post-purchase offers" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const shop = await getShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessToken = await getAccessToken(shop);
    if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

    const body = await req.json();
    const result = await upsertPostPurchaseOffer(shop, accessToken, {
      id: body.id,
      name: body.name || "",
      offerProduct: body.offerProduct ?? null,
      headline: body.headline || "",
      body: body.body || "",
      ctaLabel: body.ctaLabel || "",
      discountPercent: Number(body.discountPercent) || 10,
      priority: Number(body.priority) || 1,
      triggerType: body.triggerType || "all_orders",
      triggerProductIds: Array.isArray(body.triggerProductIds) ? body.triggerProductIds : [],
      minimumSubtotal: Number(body.minimumSubtotal) || 0,
      enabled: body.enabled !== false,
    });

    await syncCompiledState(shop, accessToken);
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    console.error("[post-purchase] POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save post-purchase offer" },
      { status: 500 },
    );
  }
}
