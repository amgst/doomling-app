import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { GiftRule } from "@/lib/firebase/giftRuleStore";
import { syncGiftRuleDerivedState } from "@/lib/shopify/giftRuleDerivedSync";
import { getGiftRulesFromMetaobjects, setGiftRulesToMetaobjects } from "@/lib/shopify/gwpRuleStore";
import { getShopGiftRulesMetafield } from "@/lib/shopify/shopGiftRulesMetafield";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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
    await syncGiftRuleDerivedState(session.shop, session.accessToken!).catch(() => null);
    return NextResponse.json({ rules, source: "metaobjects" });
  } catch {
    const fallbackRules = await getShopGiftRulesMetafield(session.shop, session.accessToken!);
    return NextResponse.json({ rules: fallbackRules, source: "shop_metafield" });
  }
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

  try {
    await setGiftRulesToMetaobjects(session.shop, session.accessToken!, body.rules);
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e), rules: body.rules, metaobjectSync: { error: errorMessage(e) } },
      { status: 400 },
    );
  }

  const { rules, ctSync, shopRulesSync, firebaseSync } = await syncGiftRuleDerivedState(
    session.shop,
    session.accessToken!,
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
