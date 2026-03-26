import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { listUpsells, addUpsell } from "@/lib/firebase/upsellStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getShop(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie ? await verifyShop(cookie) : null;
}

export async function GET(req: NextRequest) {
  const shop = await getShop(req);
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rules = await listUpsells(shop);
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const shop = await getShop(req);
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  const { triggerProductId, triggerProductTitle, upsellProducts, message } = body;
  if (!triggerProductId || !Array.isArray(upsellProducts) || upsellProducts.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const id = await addUpsell(shop, {
    triggerProductId,
    triggerProductTitle: triggerProductTitle || "",
    upsellProducts,
    message: message || "",
  });
  return NextResponse.json({ ok: true, id });
}
