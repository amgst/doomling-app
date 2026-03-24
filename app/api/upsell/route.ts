import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase/admin";
import { collection, getDocs, query, where } from "firebase/firestore";

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
  const { searchParams } = req.nextUrl;
  const shop = searchParams.get("shop") ?? "";
  const productId = searchParams.get("product_id") ?? "";

  if (!shop || !productId) {
    return NextResponse.json({ upsell: null }, { headers: CORS });
  }

  try {
    const q = query(
      collection(getDb(), "upsells", shop, "rules"),
      where("triggerProductId", "==", productId)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return NextResponse.json({ upsell: null }, { headers: CORS });
    }

    const rule = snap.docs[0].data();
    const discountedPrice = rule.discountPercent > 0
      ? (parseFloat(rule.upsellProductPrice) * (1 - rule.discountPercent / 100)).toFixed(2)
      : rule.upsellProductPrice;

    return NextResponse.json({
      upsell: {
        productId: rule.upsellProductId,
        title: rule.upsellProductTitle,
        image: rule.upsellProductImage,
        handle: rule.upsellProductHandle,
        originalPrice: rule.upsellProductPrice,
        price: discountedPrice,
        discountPercent: rule.discountPercent,
        message: rule.message,
      },
    }, { headers: CORS });
  } catch (err) {
    console.error("[api/upsell]", err);
    return NextResponse.json({ upsell: null }, { headers: CORS });
  }
}
