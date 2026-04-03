import { NextRequest, NextResponse } from "next/server";
import { listBundleOffers } from "@/lib/shopify/bundleOfferStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const shop = req.nextUrl.searchParams.get("shop")?.trim();
    if (!shop) return NextResponse.json({ error: "Missing shop" }, { status: 400 });

    const offers = await listBundleOffers(shop);
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

    return NextResponse.json({ offers: activeOffers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load bundle offers" },
      { status: 500 },
    );
  }
}
