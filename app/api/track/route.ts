import { NextRequest, NextResponse } from "next/server";
import { trackEvent, type EventType } from "@/lib/firebase/statsStore";

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

export async function POST(req: NextRequest) {
  try {
    const { shop, ruleId, event } = await req.json();
    if (!shop || !ruleId || !event) {
      return NextResponse.json({ ok: false }, { headers: CORS });
    }
    await trackEvent(shop, ruleId, event as EventType);
    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch {
    return NextResponse.json({ ok: false }, { headers: CORS });
  }
}
