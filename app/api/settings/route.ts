import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/utils/verifyRequest";
import { getShop, updateShopSettings } from "@/lib/firebase/shopStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/settings — fetch current settings for the authenticated shop
 * PUT /api/settings — update settings
 */
export async function GET(req: NextRequest) {
  const { shop, errorResponse } = await verifyRequest(req);
  if (errorResponse) return errorResponse;

  const data = await getShop(shop!);
  return NextResponse.json({ ok: true, settings: data?.settings ?? {} });
}

export async function PUT(req: NextRequest) {
  const { shop, errorResponse } = await verifyRequest(req);
  if (errorResponse) return errorResponse;

  let settings: Record<string, unknown>;
  try {
    settings = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  await updateShopSettings(shop!, settings);
  return NextResponse.json({ ok: true, settings });
}
