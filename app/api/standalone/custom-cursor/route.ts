import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyShop } from "@/lib/utils/standaloneSession";
import { getShop as getStoredShop, updateShopSettings } from "@/lib/firebase/shopStore";
import {
  normalizeCustomCursorCampaign,
  sortCustomCursorCampaigns,
  type CustomCursorCampaign,
} from "@/lib/customCursor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuthenticatedShop(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie ? await verifyShop(cookie) : null;
}

function getStoredCampaigns(settings: Record<string, unknown> | undefined): CustomCursorCampaign[] {
  const raw = settings?.customCursorCampaigns;
  if (!Array.isArray(raw)) return [];

  return sortCustomCursorCampaigns(
    raw
      .map((campaign, index) => normalizeCustomCursorCampaign(campaign, index))
      .filter((campaign): campaign is CustomCursorCampaign => Boolean(campaign)),
  );
}

export async function GET(req: NextRequest) {
  try {
    const shop = await getAuthenticatedShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const stored = await getStoredShop(shop);
    return NextResponse.json({ campaigns: getStoredCampaigns(stored?.settings) });
  } catch (error) {
    console.error("[standalone/custom-cursor] GET failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load custom cursor campaigns" },
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
    const campaigns = sortCustomCursorCampaigns(
      incomingCampaigns
        .map((campaign, index) => normalizeCustomCursorCampaign(campaign, index))
        .filter((campaign): campaign is CustomCursorCampaign => Boolean(campaign)),
    );

    const stored = await getStoredShop(shop);
    await updateShopSettings(shop, {
      ...(stored?.settings ?? {}),
      customCursorCampaigns: campaigns,
    });

    return NextResponse.json({ ok: true, campaigns });
  } catch (error) {
    console.error("[standalone/custom-cursor] PUT failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save custom cursor campaigns" },
      { status: 500 },
    );
  }
}
