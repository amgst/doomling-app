import { NextRequest, NextResponse } from "next/server";
import { buildSignedChangeset, resolvePostPurchaseOffer, verifyCheckoutRequest } from "@/lib/shopify/postPurchaseRuntime";
import { listPostPurchaseOffers } from "@/lib/shopify/postPurchaseOfferStore";
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
    const { shop, accessToken } = await verifyCheckoutRequest(req.headers.get("authorization"));
    const body = await req.json();
    const referenceId = String(body?.referenceId ?? "");
    const offerId = String(body?.changes ?? "");

    if (!referenceId) {
      return NextResponse.json({ error: "Missing referenceId" }, { status: 400, headers: corsHeaders });
    }

    const offers = await listPostPurchaseOffers(shop, accessToken);
    const offer = offers.find((entry) => entry.id === offerId) ?? null;

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404, headers: corsHeaders });
    }

    const token = await buildSignedChangeset(shop, offer, referenceId);
    return NextResponse.json({ token }, { headers: corsHeaders });
  } catch (error) {
    console.error("[post-purchase] sign changeset failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sign post-purchase changeset" },
      { status: 500, headers: corsHeaders },
    );
  }
}
