import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { listUpsellRules, upsertUpsellRule } from "@/lib/shopify/upsellRuleStore";
import { setShopUpsellRulesMetafield } from "@/lib/shopify/shopUpsellRulesMetafield";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getShop(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie ? await verifyShop(cookie) : null;
}

async function getAccessToken(shop: string) {
  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  return session?.accessToken ?? null;
}

export async function GET(req: NextRequest) {
  const shop = await getShop(req);
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const accessToken = await getAccessToken(shop);
  if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });
  const rules = await listUpsellRules(shop, accessToken);
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const shop = await getShop(req);
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const accessToken = await getAccessToken(shop);
  if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

  const body = await req.json();
  const { triggerProductId, triggerProductTitle, upsellProducts, message } = body;
  if (!triggerProductId || !Array.isArray(upsellProducts) || upsellProducts.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const result = await upsertUpsellRule(shop, accessToken, {
    triggerProductId,
    triggerProductTitle: triggerProductTitle || "",
    upsellProducts,
    message: message || "",
  });

  // Compile to shop metafield for storefront reads
  try {
    const rules = await listUpsellRules(shop, accessToken);
    await setShopUpsellRulesMetafield(shop, accessToken, rules);
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true, id: result.id });
}
