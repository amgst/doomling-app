import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/utils/verifyRequest";
import { getGiftRules, setGiftRules } from "@/lib/firebase/giftRuleStore";
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

function isMissingMetaobjectDefinition(error: unknown) {
  return /metaobject definition not found/i.test(errorMessage(error));
}

export async function GET(req: NextRequest) {
  const { session, errorResponse } = await verifyRequest(req);
  if (errorResponse) return errorResponse;

  const shop = session!.shop;
  const accessToken = session!.accessToken!;

  try {
    const rules = await getGiftRulesFromMetaobjects(shop, accessToken);
    return NextResponse.json({ rules, source: "metaobjects" });
  } catch (e) {
    if (!isMissingMetaobjectDefinition(e)) throw e;
  }

  try {
    const fallbackRules = await getShopGiftRulesMetafield(shop, accessToken);
    return NextResponse.json({ rules: fallbackRules, source: "shop_metafield" });
  } catch {}

  const firebaseRules = await getGiftRules(shop);
  return NextResponse.json({ rules: firebaseRules, source: "firebase_fallback" });
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
  let missingDefinition = false;
  try {
    await setGiftRulesToMetaobjects(shop, accessToken, body.rules);
    metaobjectSync = { ok: true };
    metaobjectOk = true;
  } catch (e) {
    metaobjectSync = { error: errorMessage(e) };
    missingDefinition = isMissingMetaobjectDefinition(e);
    if (!missingDefinition) {
      return NextResponse.json(
        { error: errorMessage(e), rules: body.rules, metaobjectSync },
        { status: 400 },
      );
    }
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

  let firebaseSync: unknown = "not_attempted";
  let firebaseOk = false;
  try {
    await setGiftRules(shop, body.rules);
    firebaseSync = { ok: true };
    firebaseOk = true;
  } catch (e) {
    firebaseSync = { error: errorMessage(e) };
  }

  if (!metaobjectOk && !shopRulesOk && !firebaseOk) {
    return NextResponse.json(
      { error: "Failed to persist gift rules", rules: body.rules, metaobjectSync, ctSync, shopRulesSync, firebaseSync },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    rules: body.rules,
    metaobjectSync,
    ctSync,
    shopRulesSync,
    firebaseSync,
    source: missingDefinition ? "shop_metafield_fallback" : "metaobjects",
  });
}
