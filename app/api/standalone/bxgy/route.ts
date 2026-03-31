import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { listBxgyRules, upsertBxgyRule } from "@/lib/shopify/bxgyRuleStore";
import { setShopBxgyRulesMetafield } from "@/lib/shopify/shopBxgyRulesMetafield";
import { syncBxgyDiscount } from "@/lib/shopify/bxgyDiscountSync";

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

async function syncCompiledState(shop: string, accessToken: string) {
  const rules = await listBxgyRules(shop, accessToken);
  await setShopBxgyRulesMetafield(shop, accessToken, rules);
  await syncBxgyDiscount(shop, accessToken, rules);
  return rules;
}

export async function GET(req: NextRequest) {
  const shop = await getShop(req);
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken = await getAccessToken(shop);
  if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

  const rules = await listBxgyRules(shop, accessToken);
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const shop = await getShop(req);
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken = await getAccessToken(shop);
  if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

  const body = await req.json();
  const result = await upsertBxgyRule(shop, accessToken, {
    id: body.id,
    name: body.name || "",
    buyProducts: Array.isArray(body.buyProducts) ? body.buyProducts : [],
    giftProduct: body.giftProduct ?? null,
    buyQuantity: Number(body.buyQuantity) || 1,
    giftQuantity: Number(body.giftQuantity) || 1,
    message: body.message || "",
    autoAdd: body.autoAdd !== false,
    priority: Number(body.priority) || 1,
    enabled: body.enabled !== false,
  });

  await syncCompiledState(shop, accessToken);
  return NextResponse.json({ ok: true, id: result.id });
}
