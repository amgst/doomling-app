import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import {
  GiftRule,
} from "@/lib/firebase/giftRuleStore";
import { getGiftRulesFromMetaobjects, setGiftRulesToMetaobjects } from "@/lib/shopify/gwpRuleStore";
import { syncGiftConfigToCartTransform } from "@/lib/shopify/cartTransformGiftConfig";
import { getShopGiftRulesMetafield, setShopGiftRulesMetafield } from "@/lib/shopify/shopGiftRulesMetafield";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isMissingMetaobjectDefinition(error: unknown) {
  return /metaobject definition not found/i.test(errorMessage(error));
}

async function getSession(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return null;
  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  if (!session?.accessToken) return null;
  return session;
}

export type { GiftRule };

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rules = await getGiftRulesFromMetaobjects(session.shop, session.accessToken!);
    return NextResponse.json({ rules, source: "metaobjects" });
  } catch (e) {
    if (!isMissingMetaobjectDefinition(e)) throw e;
  }

  const fallbackRules = await getShopGiftRulesMetafield(session.shop, session.accessToken!);
  return NextResponse.json({ rules: fallbackRules, source: "shop_metafield" });
}

export async function PUT(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { rules: GiftRule[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let metaobjectSync: unknown = "not_attempted";
  let metaobjectOk = false;
  let missingDefinition = false;
  try {
    await setGiftRulesToMetaobjects(session.shop, session.accessToken!, body.rules);
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
    ctSync = await syncGiftConfigToCartTransform(session.shop, session.accessToken!, body.rules);
  } catch (e) {
    ctSync = { error: errorMessage(e) };
  }

  let shopRulesSync: unknown = "not_attempted";
  let shopRulesOk = false;
  try {
    await setShopGiftRulesMetafield(session.shop, session.accessToken!, body.rules);
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

  return NextResponse.json({ ok: true, rules: body.rules, metaobjectSync, ctSync, shopRulesSync, source: missingDefinition ? "shop_metafield_fallback" : "metaobjects" });
}
