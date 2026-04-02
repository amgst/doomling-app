import { NextRequest, NextResponse } from "next/server";
import { getShop } from "@/lib/firebase/shopStore";
import { getSpecificGeoCountdownCampaign, matchGeoCountdownCampaign, normalizeGeoCountdownCampaign, type GeoCountdownCampaign } from "@/lib/geoCountdown";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function getStoredCampaigns(settings: Record<string, unknown> | undefined): GeoCountdownCampaign[] {
  const raw = settings?.geoCountdownCampaigns;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((campaign, index) => normalizeGeoCountdownCampaign(campaign, index))
    .filter((campaign): campaign is GeoCountdownCampaign => Boolean(campaign));
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop") ?? "";
  if (!shop) {
    return NextResponse.json({ campaign: null }, { headers: CORS });
  }

  try {
    const stored = await getShop(shop);
    const campaigns = getStoredCampaigns(stored?.settings);
    const mode = req.nextUrl.searchParams.get("mode") ?? "auto";
    const campaign = mode === "specific"
      ? getSpecificGeoCountdownCampaign(campaigns, req.nextUrl.searchParams.get("campaignId"))
      : matchGeoCountdownCampaign(campaigns, {
          country: req.nextUrl.searchParams.get("country"),
          pageTarget: req.nextUrl.searchParams.get("pageTarget"),
        });

    return NextResponse.json({ campaign }, { headers: CORS });
  } catch (error) {
    console.error("[api/public/geo-countdown]", error);
    return NextResponse.json({ campaign: null }, { headers: CORS });
  }
}

