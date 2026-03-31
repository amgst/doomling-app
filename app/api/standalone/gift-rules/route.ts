import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import {
  GiftRule,
} from "@/lib/firebase/giftRuleStore";
import { getGiftRulesFromMetaobjects, setGiftRulesToMetaobjects } from "@/lib/shopify/gwpRuleStore";
import { syncGiftConfigToCartTransform } from "@/lib/shopify/cartTransformGiftConfig";
import { setShopGiftRulesMetafield } from "@/lib/shopify/shopGiftRulesMetafield";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const rules = await getGiftRulesFromMetaobjects(session.shop, session.accessToken!);
  return NextResponse.json({ rules, source: "metaobjects" });
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

  // Save to Shopify (metaobjects) — source of truth
  try {
    await setGiftRulesToMetaobjects(session.shop, session.accessToken!, body.rules);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), metaobjectSync: { error: e instanceof Error ? e.message : String(e) } },
      { status: 400 },
    );
  }

  // Sync config to CartTransform metafield so the cart transform function can read it
  let ctSync: unknown = "not_attempted";
  try {
    ctSync = await syncGiftConfigToCartTransform(session.shop, session.accessToken!, body.rules);
  } catch (e) {
    ctSync = { error: e instanceof Error ? e.message : String(e) };
  }

  // Persist rules to a Shop metafield so the theme can read rules instantly (no extra runtime fetch)
  let shopRulesSync: unknown = "not_attempted";
  try {
    await setShopGiftRulesMetafield(session.shop, session.accessToken!, body.rules);
    shopRulesSync = { ok: true };
  } catch (e) {
    shopRulesSync = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ ok: true, rules: body.rules, metaobjectSync: { ok: true }, ctSync, shopRulesSync });
}
