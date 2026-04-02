import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyShop } from "@/lib/utils/standaloneSession";
import { getShop as getStoredShop, updateShopSettings } from "@/lib/firebase/shopStore";
import {
  normalizeGeoCountdownCampaign,
  sortGeoCountdownCampaigns,
  type GeoCountdownCampaign,
} from "@/lib/geoCountdown";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuthenticatedShop(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie ? await verifyShop(cookie) : null;
}

function getStoredCampaigns(settings: Record<string, unknown> | undefined): GeoCountdownCampaign[] {
  const raw = settings?.geoCountdownCampaigns;
  if (!Array.isArray(raw)) return [];

  return sortGeoCountdownCampaigns(
    raw
      .map((campaign, index) => normalizeGeoCountdownCampaign(campaign, index))
      .filter((campaign): campaign is GeoCountdownCampaign => Boolean(campaign)),
  );
}

export async function GET(req: NextRequest) {
  try {
    const shop = await getAuthenticatedShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const stored = await getStoredShop(shop);
    return NextResponse.json({ campaigns: getStoredCampaigns(stored?.settings) });
  } catch (error) {
    console.error("[standalone/geo-countdown] GET failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load geo countdown campaigns" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const shop = await getAuthenticatedShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const incomingCampaigns: unknown[] = Array.isArray(body?.campaigns) ? body.campaigns : [];
    const campaigns = sortGeoCountdownCampaigns(
      incomingCampaigns
        .map((campaign, index) => normalizeGeoCountdownCampaign(campaign, index))
        .filter((campaign): campaign is GeoCountdownCampaign => Boolean(campaign)),
    );

    const stored = await getStoredShop(shop);
    await updateShopSettings(shop, {
      ...(stored?.settings ?? {}),
      geoCountdownCampaigns: campaigns,
    });

    return NextResponse.json({ ok: true, campaigns });
  } catch (error) {
    console.error("[standalone/geo-countdown] PUT failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save geo countdown campaigns" },
      { status: 500 },
    );
  }
}
