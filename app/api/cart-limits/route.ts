import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/utils/verifyRequest";
import {
  getShopCartQuantityRulesMetafield,
  setShopCartQuantityRulesMetafield,
  type CartQuantityRule,
} from "@/lib/shopify/shopCartQuantityRulesMetafield";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const { session, shop, errorResponse } = await verifyRequest(req);
  if (errorResponse) return errorResponse;
  if (!session?.accessToken || !shop) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rules = await getShopCartQuantityRulesMetafield(shop, session.accessToken);
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("[api/cart-limits] GET failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load cart limits" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const { session, shop, errorResponse } = await verifyRequest(req);
  if (errorResponse) return errorResponse;
  if (!session?.accessToken || !shop) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const incomingRules: unknown[] = Array.isArray(body?.rules) ? body.rules : [];
    const rules = incomingRules
      .map((rule: unknown, index: number) => normalizeRule(rule, index))
      .filter((rule): rule is CartQuantityRule => Boolean(rule));

    const deduped = Array.from(new Map(rules.map((rule) => [rule.productId, rule])).values()).sort((a, b) =>
      a.productTitle.localeCompare(b.productTitle),
    );

    await setShopCartQuantityRulesMetafield(shop, session.accessToken, deduped);
    return NextResponse.json({ ok: true, rules: deduped });
  } catch (error) {
    console.error("[api/cart-limits] PUT failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save cart limits" },
      { status: 500 },
    );
  }
}
