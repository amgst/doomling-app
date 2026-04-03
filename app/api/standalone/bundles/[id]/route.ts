import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { archiveBundleOfferDiscount } from "@/lib/shopify/bundleOfferDiscountSync";
import { deleteBundleOffer } from "@/lib/shopify/bundleOfferStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getShop(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie ? await verifyShop(cookie) : null;
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const shop = await getShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
    if (!session?.accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

    const removed = await deleteBundleOffer(shop, params.id);
    if (removed) {
      try {
        await archiveBundleOfferDiscount(shop, session.accessToken, removed);
      } catch (error) {
        console.error("[bundles] archive discount failed", error);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete bundle offer" },
      { status: 500 },
    );
  }
}
