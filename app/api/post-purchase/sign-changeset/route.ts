import { NextRequest, NextResponse } from "next/server";
import { buildSignedChangeset, resolvePostPurchaseOffer, verifyCheckoutRequest } from "@/lib/shopify/postPurchaseRuntime";
import { listPostPurchaseOffers } from "@/lib/shopify/postPurchaseOfferStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { shop, accessToken } = await verifyCheckoutRequest(req.headers.get("authorization"));
    const body = await req.json();
    const referenceId = String(body?.referenceId ?? "");
    const offerId = String(body?.changes ?? "");

    if (!referenceId) {
      return NextResponse.json({ error: "Missing referenceId" }, { status: 400 });
    }

    const offers = await listPostPurchaseOffers(shop, accessToken);
    const offer = offers.find((entry) => entry.id === offerId) ?? null;

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    const token = await buildSignedChangeset(shop, offer, referenceId);
    return NextResponse.json({ token });
  } catch (error) {
    console.error("[post-purchase] sign changeset failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sign post-purchase changeset" },
      { status: 500 },
    );
  }
}
