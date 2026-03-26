import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase/admin";
import { collection, getDocs, query, where } from "firebase/firestore";
import { normalizeRule } from "@/lib/firebase/upsellStore";

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
    return NextResponse.json({ upsells: [] }, { headers: CORS });
  }

  try {
    const q = query(
      collection(getDb(), "upsells", shop, "rules"),
      where("triggerProductId", "==", productId)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return NextResponse.json({ upsells: [] }, { headers: CORS });
    }

    const doc = snap.docs[0];
    const rule = normalizeRule(doc.id, doc.data() as Record<string, unknown>);

    const upsells = rule.upsellProducts.map(p => ({
      ruleId: rule.id,
      productId: p.productId,
      title: p.title,
      image: p.image,
      handle: p.handle,
      originalPrice: p.price,
      price: p.discountPercent > 0
        ? (parseFloat(p.price) * (1 - p.discountPercent / 100)).toFixed(2)
        : p.price,
      discountPercent: p.discountPercent,
      message: rule.message,
    }));

    return NextResponse.json({ upsells }, { headers: CORS });
  } catch (err) {
    console.error("[api/upsell]", err);
    return NextResponse.json({ upsells: [] }, { headers: CORS });
  }
}
