import { NextRequest, NextResponse } from "next/server";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { deletePostPurchaseOffer, listPostPurchaseOffers } from "@/lib/shopify/postPurchaseOfferStore";
import { setShopPostPurchaseOffersMetafield } from "@/lib/shopify/shopPostPurchaseOffersMetafield";
import { COOKIE_NAME, verifyShop } from "@/lib/utils/standaloneSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getShop(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie ? await verifyShop(cookie) : null;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const shop = await getShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
    if (!session?.accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

    const { id } = await params;
    await deletePostPurchaseOffer(shop, session.accessToken, id);

    const offers = await listPostPurchaseOffers(shop, session.accessToken);
    await setShopPostPurchaseOffersMetafield(shop, session.accessToken, offers);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[post-purchase] DELETE failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete post-purchase offer" },
      { status: 500 },
    );
  }
}
