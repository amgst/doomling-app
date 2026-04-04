import { NextRequest, NextResponse } from "next/server";
import { trackEvent, type EventType } from "@/lib/firebase/statsStore";
import { ensureInstalledPublicShop } from "@/lib/utils/publicShopAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const ALLOWED_EVENTS: EventType[] = ["view", "click", "added"];

export async function POST(req: NextRequest) {
  try {
    const { shop: rawShop, ruleId, event } = await req.json();
    const { shop, errorResponse } = await ensureInstalledPublicShop(rawShop);

    if (errorResponse || typeof ruleId !== "string" || !ruleId.trim() || !ALLOWED_EVENTS.includes(event)) {
      return NextResponse.json({ ok: false }, { status: errorResponse?.status ?? 400, headers: CORS });
    }

    await trackEvent(shop!, ruleId.trim(), event);
    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }
}
