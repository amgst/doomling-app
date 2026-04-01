import { NextRequest, NextResponse } from "next/server";
import { buildRuntimeOffer, resolvePostPurchaseOffer, trackOfferView, verifyCheckoutRequest } from "@/lib/shopify/postPurchaseRuntime";
import { buildPostPurchaseCorsHeaders } from "@/lib/utils/postPurchaseCors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: buildPostPurchaseCorsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const corsHeaders = buildPostPurchaseCorsHeaders(req.headers.get("origin"));
  try {
    const body = await req.json();
    const { shop, accessToken } = await verifyCheckoutRequest(
      req.headers.get("authorization"),
      body?.shopDomain,
    );
    const offer = await resolvePostPurchaseOffer(shop, accessToken, body?.initialPurchase);

    if (!offer) {
      return NextResponse.json({ offer: null, render: false }, { headers: corsHeaders });
    }

    await trackOfferView(shop, offer.id);
    return NextResponse.json({ offer: buildRuntimeOffer(offer), render: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("[post-purchase] offer endpoint failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve post-purchase offer" },
      { status: 500, headers: corsHeaders },
    );
  }
}
