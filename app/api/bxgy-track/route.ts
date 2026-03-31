import { NextRequest, NextResponse } from "next/server";
import { trackBxgyEvent, type BxgyEventType } from "@/lib/firebase/bxgyStatsStore";

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

    await trackBxgyEvent(shop, ruleId, event as BxgyEventType);
    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch {
    return NextResponse.json({ ok: false }, { headers: CORS });
  }
}
