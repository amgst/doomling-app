import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { getPromotion, savePromotion } from "@/lib/firebase/promotionStore";
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

  // If variantId is missing but we have a product ID, fetch it from Shopify Admin API
  if (!body.giftVariantId && body.giftProductId && session?.accessToken) {
    try {
      const res = await fetch(
        `https://${shop}/admin/api/2024-01/products/${body.giftProductId}.json?fields=variants`,
        { headers: { "X-Shopify-Access-Token": session.accessToken } }
      );
      if (res.ok) {
        const data = await res.json();
        body.giftVariantId = String(data.product?.variants?.[0]?.id ?? "");
      }
    } catch {}
  }

  // Read existing discountId before saving (merge won't delete it, but we need it for sync)
  const existing = await getPromotion(shop);
  await savePromotion(shop, body);

  // Sync Shopify Automatic Discount (best-effort)
  if (session?.accessToken) {
    try {
      const config = JSON.stringify({
        threshold: Number(body.threshold) || 50,
        giftVariantId: body.giftVariantId,
      });

      if (body.active && body.giftVariantId) {
        if (existing.discountId) {
          // Update metafields on the existing discount
          await updateDiscountConfig(shop, session.accessToken, existing.discountId, config);
        } else {
          // Create a new Shopify Automatic Discount linked to the function
          const discountId = await createShopifyDiscount(shop, session.accessToken, config);
          if (discountId) await savePromotion(shop, { discountId });
        }
      } else if (!body.active && existing.discountId) {
        // Remove the discount when promotion is deactivated
        await deleteShopifyDiscount(shop, session.accessToken, existing.discountId);
        await savePromotion(shop, { discountId: "" });
      }
    } catch {}
  }

  return NextResponse.json({ ok: true });
}
