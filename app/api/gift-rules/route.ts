import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/utils/verifyRequest";
import { getGiftRulesFromMetaobjects, setGiftRulesToMetaobjects } from "@/lib/shopify/gwpRuleStore";
import { syncGiftConfigToCartTransform } from "@/lib/shopify/cartTransformGiftConfig";
import { getShopGiftRulesMetafield, setShopGiftRulesMetafield } from "@/lib/shopify/shopGiftRulesMetafield";

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
    if (rules.length > 0) {
      return NextResponse.json({ rules, source: "metaobjects" });
    }
  } catch {}

  const fallbackRules = await getShopGiftRulesMetafield(shop, accessToken);
  return NextResponse.json({ rules: fallbackRules, source: "shop_metafield" });
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

  let metaobjectSync: unknown = "not_attempted";
  let metaobjectOk = false;
  try {
    await setGiftRulesToMetaobjects(shop, accessToken, body.rules);
    metaobjectSync = { ok: true };
    metaobjectOk = true;
  } catch (e) {
    metaobjectSync = { error: errorMessage(e) };
  }

  let ctSync: unknown = "not_attempted";
  try {
    ctSync = await syncGiftConfigToCartTransform(shop, accessToken, body.rules);
  } catch (e) {
    ctSync = { error: errorMessage(e) };
  }

  let shopRulesSync: unknown = "not_attempted";
  let shopRulesOk = false;
  try {
    await setShopGiftRulesMetafield(shop, accessToken, body.rules);
    shopRulesSync = { ok: true };
    shopRulesOk = true;
  } catch (e) {
    shopRulesSync = { error: errorMessage(e) };
  }

  if (!metaobjectOk && !shopRulesOk) {
    return NextResponse.json(
      { error: "Failed to persist gift rules", rules: body.rules, metaobjectSync, ctSync, shopRulesSync },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, rules: body.rules, metaobjectSync, ctSync, shopRulesSync });
}
