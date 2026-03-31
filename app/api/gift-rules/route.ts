import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/utils/verifyRequest";
import { syncGiftRuleDerivedState } from "@/lib/shopify/giftRuleDerivedSync";
import { getGiftRulesFromMetaobjects, setGiftRulesToMetaobjects } from "@/lib/shopify/gwpRuleStore";
import { getShopGiftRulesMetafield } from "@/lib/shopify/shopGiftRulesMetafield";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface GiftRule {
  mainVariantId: string;
  giftVariantId: string;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(req: NextRequest) {
  const { session, errorResponse } = await verifyRequest(req);
  if (errorResponse) return errorResponse;

  const shop = session!.shop;
  const accessToken = session!.accessToken!;

  try {
    const rules = await getGiftRulesFromMetaobjects(shop, accessToken);
    await syncGiftRuleDerivedState(shop, accessToken).catch(() => null);
    return NextResponse.json({ rules, source: "metaobjects" });
  } catch {
    const fallbackRules = await getShopGiftRulesMetafield(shop, accessToken);
    return NextResponse.json({ rules: fallbackRules, source: "shop_metafield" });
  }
}

export async function PUT(req: NextRequest) {
  const { session, errorResponse } = await verifyRequest(req);
  if (errorResponse) return errorResponse;

  let body: { rules: GiftRule[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const shop = session!.shop;
  const accessToken = session!.accessToken!;

  try {
    await setGiftRulesToMetaobjects(shop, accessToken, body.rules);
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e), rules: body.rules, metaobjectSync: { error: errorMessage(e) } },
      { status: 400 },
    );
  }

  const { rules, ctSync, shopRulesSync, firebaseSync } = await syncGiftRuleDerivedState(
    shop,
    accessToken,
  );

  return NextResponse.json({
    ok: true,
    rules,
    metaobjectSync: { ok: true },
    ctSync,
    shopRulesSync,
    firebaseSync,
    source: "metaobjects",
  });
}
