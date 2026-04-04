import { NextRequest, NextResponse } from "next/server";
import { listBundleOffers } from "@/lib/shopify/bundleOfferStore";
import { ensureInstalledPublicShop } from "@/lib/utils/publicShopAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  try {
    const { shop, errorResponse } = await ensureInstalledPublicShop(req.nextUrl.searchParams.get("shop"));
    if (errorResponse) {
      return NextResponse.json({ offers: [] }, { status: errorResponse.status, headers: CORS });
    }

    const offers = await listBundleOffers(shop!);
    const activeOffers = offers
      .filter((offer) => offer.enabled)
      .map((offer) => ({
        id: offer.id,
        name: offer.name,
        productId: offer.productId,
        productTitle: offer.productTitle,
        code: offer.code,
        compareAtPrice: offer.compareAtPrice,
        discountedPrice: offer.discountedPrice,
      }));

    return NextResponse.json({ offers: activeOffers }, { headers: CORS });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load bundle offers", offers: [] },
      { status: 500, headers: CORS },
    );
  }
}
