import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import {
  getShopCartQuantityRulesMetafield,
  setShopCartQuantityRulesMetafield,
  type CartQuantityRule,
} from "@/lib/shopify/shopCartQuantityRulesMetafield";

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

function normalizeRule(input: unknown, index: number): CartQuantityRule | null {
  if (!input || typeof input !== "object") return null;

  const value = input as Record<string, unknown>;
  const productId = String(value.productId ?? "").trim();
  const productTitle = String(value.productTitle ?? "").trim();
  const quantity = Math.max(1, Math.min(10, Number(value.quantity) || 1));

  if (!productId || !productTitle) return null;

  return {
    id: String(value.id ?? `cart-limit-${productId}-${index}`),
    productId,
    productTitle,
    quantity,
    enabled: value.enabled !== false,
  };
}

export async function GET(req: NextRequest) {
  try {
    const shop = await getShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessToken = await getAccessToken(shop);
    if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

    const rules = await getShopCartQuantityRulesMetafield(shop, accessToken);
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("[cart-limits] GET failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load cart limits" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const shop = await getShop(req);
    if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessToken = await getAccessToken(shop);
    if (!accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

    const body = await req.json();
    const incomingRules = Array.isArray(body?.rules) ? body.rules : [];
    const rules = incomingRules
      .map((rule, index) => normalizeRule(rule, index))
      .filter((rule): rule is CartQuantityRule => Boolean(rule));

    const deduped = Array.from(
      new Map(rules.map((rule) => [rule.productId, rule])).values(),
    ).sort((a, b) => a.productTitle.localeCompare(b.productTitle));

    await setShopCartQuantityRulesMetafield(shop, accessToken, deduped);
    return NextResponse.json({ ok: true, rules: deduped });
  } catch (error) {
    console.error("[cart-limits] PUT failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save cart limits" },
      { status: 500 },
    );
  }
}
