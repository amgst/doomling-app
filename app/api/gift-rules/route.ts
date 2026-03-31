import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/utils/verifyRequest";
import { getGiftRulesFromMetaobjects, setGiftRulesToMetaobjects } from "@/lib/shopify/gwpRuleStore";
import { syncGiftConfigToCartTransform } from "@/lib/shopify/cartTransformGiftConfig";
import { setShopGiftRulesMetafield } from "@/lib/shopify/shopGiftRulesMetafield";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface GiftRule {
  mainVariantId: string;
  giftVariantId: string;
}

export async function GET(req: NextRequest) {
  const { session, errorResponse } = await verifyRequest(req);
  if (errorResponse) return errorResponse;

  const shop = session!.shop;
  const accessToken = session!.accessToken!;

  const rules = await getGiftRulesFromMetaobjects(shop, accessToken);
  return NextResponse.json({ rules, source: "metaobjects" });
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
      { error: e instanceof Error ? e.message : String(e), metaobjectSync: { error: e instanceof Error ? e.message : String(e) } },
      { status: 400 },
    );
  }

  let ctSync: unknown = "not_attempted";
  try {
    ctSync = await syncGiftConfigToCartTransform(shop, accessToken, body.rules);
  } catch (e) {
    ctSync = { error: e instanceof Error ? e.message : String(e) };
  }

  let shopRulesSync: unknown = "not_attempted";
  try {
    await setShopGiftRulesMetafield(shop, accessToken, body.rules);
    shopRulesSync = { ok: true };
  } catch (e) {
    shopRulesSync = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ ok: true, rules: body.rules, metaobjectSync: { ok: true }, ctSync, shopRulesSync });
}
