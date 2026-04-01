import { NextRequest, NextResponse } from "next/server";
import { buildRuntimeOffer, resolvePostPurchaseOffer, trackOfferView, verifyCheckoutRequest } from "@/lib/shopify/postPurchaseRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { shop, accessToken } = await verifyCheckoutRequest(req.headers.get("authorization"));
    const body = await req.json();
    const offer = await resolvePostPurchaseOffer(shop, accessToken, body?.initialPurchase);

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
