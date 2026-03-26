import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { getPromotion, savePromotion, type PromotionTier } from "@/lib/firebase/promotionStore";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getShop(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  return cookie ? await verifyShop(cookie) : null;
}

async function gqlAdmin(shop: string, token: string, query: string, variables?: object) {
  const res = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function getFunctionId(shop: string, token: string): Promise<string | null> {
  const data = await gqlAdmin(shop, token, `{
    shopifyFunctions(first: 25) {
      nodes { id apiType }
    }
  }`);
  const nodes: { id: string; apiType: string }[] = data?.data?.shopifyFunctions?.nodes ?? [];
  const fn = nodes.find(f => f.apiType === "cart_lines_discounts_generate_run");
  return fn?.id ?? null;
}

async function createShopifyDiscount(shop: string, token: string, config: string): Promise<string | null> {
  const functionId = await getFunctionId(shop, token);
  if (!functionId) return null;
  const data = await gqlAdmin(shop, token, `
    mutation CreateDiscount($input: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $input) {
        automaticAppDiscount { discountId }
        userErrors { field message }
      }
    }
  `, {
    input: {
      title: "Upsale Free Gift",
      functionId,
      startsAt: "2020-01-01T00:00:00Z",
      metafields: [{ namespace: "upsale", key: "config", type: "json", value: config }],
    },
  });
  return data?.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId ?? null;
}

async function updateDiscountConfig(shop: string, token: string, discountId: string, config: string) {
  await gqlAdmin(shop, token, `
    mutation UpdateMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }
  `, {
    metafields: [{ ownerId: discountId, namespace: "upsale", key: "config", type: "json", value: config }],
  });
}

async function deleteShopifyDiscount(shop: string, token: string, discountId: string) {
  await gqlAdmin(shop, token, `
    mutation DeleteDiscount($id: ID!) {
      discountAutomaticDelete(id: $id) {
        deletedAutomaticDiscountId
        userErrors { field message }
      }
    }
  `, { id: discountId });
}

async function fetchVariantId(shop: string, token: string, productId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://${shop}/admin/api/2024-01/products/${productId}.json?fields=variants`,
      { headers: { "X-Shopify-Access-Token": token } }
    );
    if (res.ok) {
      const data = await res.json();
      return String(data.product?.variants?.[0]?.id ?? "");
    }
  } catch {}
  return "";
}

export async function GET(req: NextRequest) {
  const shop = await getShop(req);
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const promotion = await getPromotion(shop);
  return NextResponse.json({ promotion });
}

export async function POST(req: NextRequest) {
  const shop = await getShop(req);
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  const sessionId = `offline_${shop}`;
  const session = await firestoreSessionStorage.loadSession(sessionId);

  // Resolve variantIds for any tier missing them
  if (session?.accessToken && Array.isArray(body.tiers)) {
    for (const tier of body.tiers as PromotionTier[]) {
      if (!tier.giftVariantId && tier.giftProductId) {
        tier.giftVariantId = await fetchVariantId(shop, session.accessToken, tier.giftProductId);
      }
    }
  }

  const existing = await getPromotion(shop);
  await savePromotion(shop, body);

  // Sync Shopify Automatic Discount (best-effort)
  if (session?.accessToken) {
    try {
      const validTiers = (body.tiers as PromotionTier[] ?? [])
        .filter(t => t.giftVariantId)
        .map(t => ({ threshold: Number(t.threshold) || 50, giftVariantId: t.giftVariantId }));

      const config = JSON.stringify({ tiers: validTiers });

      if (body.active && validTiers.length > 0) {
        if (existing.discountId) {
          await updateDiscountConfig(shop, session.accessToken, existing.discountId, config);
        } else {
          const discountId = await createShopifyDiscount(shop, session.accessToken, config);
          if (discountId) await savePromotion(shop, { discountId });
        }
      } else if (!body.active && existing.discountId) {
        await deleteShopifyDiscount(shop, session.accessToken, existing.discountId);
        await savePromotion(shop, { discountId: "" });
      }
    } catch {}
  }

  return NextResponse.json({ ok: true });
}
