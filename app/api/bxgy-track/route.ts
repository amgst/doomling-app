import { NextRequest, NextResponse } from "next/server";
import { trackBxgyEvent, type BxgyEventType } from "@/lib/firebase/bxgyStatsStore";
import { ensureInstalledPublicShop } from "@/lib/utils/publicShopAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const ALLOWED_EVENTS: BxgyEventType[] = ["qualified", "auto_added"];

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const { shop: rawShop, ruleId, event } = await req.json();
    const { shop, errorResponse } = await ensureInstalledPublicShop(rawShop);

    if (errorResponse || typeof ruleId !== "string" || !ruleId.trim() || !ALLOWED_EVENTS.includes(event)) {
      return NextResponse.json({ ok: false }, { status: errorResponse?.status ?? 400, headers: CORS });
    }

    await trackBxgyEvent(shop!, ruleId.trim(), event as BxgyEventType);
    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch {
    return NextResponse.json({ ok: false }, { headers: CORS });
  }
}
