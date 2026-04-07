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
  const rules = await listUpsellRules(shop, accessToken, { includeDisabled: true });
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const shop = await getShop(req);
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const accessToken = await getAccessToken(shop);
  if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { id, triggerProductId, triggerProductTitle, upsellProducts, message, enabled } = body as Record<string, unknown>;
  if (!triggerProductId || !Array.isArray(upsellProducts) || upsellProducts.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  let result: { id: string };
  try {
    result = await upsertUpsellRule(shop, accessToken, {
      id: id as string | undefined,
      triggerProductId: triggerProductId as string,
      triggerProductTitle: (triggerProductTitle as string) || "",
      upsellProducts: upsellProducts as never,
      message: (message as string) || "",
      enabled: enabled !== false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save rule";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Compile to shop metafield for storefront reads
  try {
    const rules = await listUpsellRules(shop, accessToken);
    await setShopUpsellRulesMetafield(shop, accessToken, rules);
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true, id: result.id });
}
