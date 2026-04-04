import { NextRequest, NextResponse } from "next/server";
import { ensureInstalledPublicShop } from "@/lib/utils/publicShopAccess";
import {
  matchCustomCursorCampaign,
  normalizeCustomCursorCampaign,
  type CustomCursorCampaign,
} from "@/lib/customCursor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function getStoredCampaigns(settings: Record<string, unknown> | undefined): CustomCursorCampaign[] {
  const raw = settings?.customCursorCampaigns;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((campaign, index) => normalizeCustomCursorCampaign(campaign, index))
    .filter((campaign): campaign is CustomCursorCampaign => Boolean(campaign));
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const { stored, errorResponse } = await ensureInstalledPublicShop(req.nextUrl.searchParams.get("shop"));
  if (errorResponse) {
    return NextResponse.json({ campaign: null }, { status: errorResponse.status, headers: CORS });
  }

  try {
    const campaigns = getStoredCampaigns(stored?.settings);
    const campaign = matchCustomCursorCampaign(campaigns, {
      pageTarget: req.nextUrl.searchParams.get("pageTarget"),
    });

    return NextResponse.json({ campaign }, { headers: CORS });
  } catch (error) {
    console.error("[api/public/custom-cursor]", error);
    return NextResponse.json({ campaign: null }, { headers: CORS });
  }
}
