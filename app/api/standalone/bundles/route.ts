import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { listBundleOffers, saveBundleOffer, upsertBundleOffer } from "@/lib/shopify/bundleOfferStore";
import { syncBundleOfferDiscount } from "@/lib/shopify/bundleOfferDiscountSync";

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

export async function GET(req: NextRequest) {
  try {
    const shop = await getShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const offers = await listBundleOffers(shop);
    return NextResponse.json({ offers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load bundle offers" },
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
    const saved = await upsertBundleOffer(shop, {
      id: body.id,
      name: body.name,
      productId: body.productId,
      productTitle: body.productTitle,
      code: body.code,
      compareAtPrice: body.compareAtPrice,
      discountedPrice: body.discountedPrice,
      enabled: body.enabled !== false,
      discountId: body.discountId,
    });

    let warning: string | null = null;
    try {
      const discountId = await syncBundleOfferDiscount(shop, accessToken, saved);
      if (discountId && discountId !== saved.discountId) {
        await saveBundleOffer(shop, { ...saved, discountId });
      }
    } catch (error) {
      warning = error instanceof Error ? error.message : "Bundle offer saved, but discount sync failed.";
    }

    const offers = await listBundleOffers(shop);
    return NextResponse.json({ ok: true, offers, warning });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save bundle offer" },
      { status: 500 },
    );
  }
}
