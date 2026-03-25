import { NextRequest, NextResponse } from "next/server";
import { getPromotion } from "@/lib/firebase/promotionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop") ?? "";
  if (!shop) return NextResponse.json({ promotion: null }, { headers: CORS });
  try {
    const promotion = await getPromotion(shop);
    if (!promotion.active || !promotion.giftProductId) {
      return NextResponse.json({ promotion: null }, { headers: CORS });
    }
    return NextResponse.json({ promotion }, { headers: CORS });
  } catch {
    return NextResponse.json({ promotion: null }, { headers: CORS });
  }
}
