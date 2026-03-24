import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/utils/verifyRequest";
import { getShopify } from "@/lib/shopify/client";
import { getShop } from "@/lib/firebase/shopStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/shop
 * Returns the current shop info from Shopify Admin API + stored metadata.
 */
export async function GET(req: NextRequest) {
  const { session, shop, errorResponse } = await verifyRequest(req);
  if (errorResponse) return errorResponse;

  try {
    // Fetch shop data from Shopify
    const client = new (getShopify().clients.Rest)({ session: session! });
    const shopData = await client.get({ path: "shop" });

    // Fetch stored metadata from Firestore
    const stored = await getShop(shop!);

    return NextResponse.json({
      ok: true,
      shop: shopData.body,
      metadata: stored,
    });
  } catch (err) {
    console.error("[api/shop] Error:", err);
    return NextResponse.json({ error: "Failed to fetch shop data" }, { status: 500 });
  }
}
