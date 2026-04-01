import { NextRequest, NextResponse } from "next/server";
import { buildRuntimeOffer, resolvePostPurchaseOffer, trackOfferView, verifyCheckoutRequest } from "@/lib/shopify/postPurchaseRuntime";
import { listPostPurchaseOffers } from "@/lib/shopify/postPurchaseOfferStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const FORCE_RENDER_FOR_TESTING = true;

export async function POST(req: NextRequest) {
  try {
    const { shop, accessToken } = await verifyCheckoutRequest(req.headers.get("authorization"));
    const body = await req.json();
    let offer = await resolvePostPurchaseOffer(shop, accessToken, body?.initialPurchase);

    // Temporary test override: always render the first active offer so we can
    // verify the extension and checkout wiring independently of targeting.
    if (!offer && FORCE_RENDER_FOR_TESTING) {
      const offers = await listPostPurchaseOffers(shop, accessToken);
      offer = offers[0] ?? null;
    }

    if (!offer) {
      return NextResponse.json({ offer: null, render: false });
    }

    await trackOfferView(shop, offer.id);
    return NextResponse.json({ offer: buildRuntimeOffer(offer), render: true });
  } catch (error) {
    console.error("[post-purchase] offer endpoint failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve post-purchase offer" },
      { status: 500 },
    );
  }
}
