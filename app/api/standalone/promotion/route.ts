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

const EXTENSION_HANDLE = "upsale-discount";

async function getFunctionGid(shop: string, token: string): Promise<string | null> {
  const data = await gqlAdmin(shop, token, `{
    shopifyFunctions(first: 25) {
      nodes { id apiType handle }
    }
  }`);
  const nodes: { id: string; apiType: string; handle: string }[] =
    data?.data?.shopifyFunctions?.nodes ?? [];

  // Prefer exact handle match, then fall back to any discount-type function from this app
  const fn =
    nodes.find(f => f.handle === EXTENSION_HANDLE) ??
    nodes.find(f =>
      ["discount", "cart_lines_discounts_generate_run", "CART_LINES_DISCOUNTS_GENERATE_RUN"]
        .includes(f.apiType) ||
      f.apiType?.toLowerCase().replace(/[-\.]/g, "_").includes("cart_lines_discounts")
    );
  return fn?.id ?? null;
}

async function createShopifyDiscount(
  shop: string, token: string, config: string
): Promise<{ discountId: string | null; error: string | null }> {
  const functionId = await getFunctionGid(shop, token);
  if (!functionId) {
    return { discountId: null, error: "Shopify Function not found — run: shopify app deploy --allow-updates" };
  }

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
  const userErrors = data?.data?.discountAutomaticAppCreate?.userErrors ?? [];
  if (userErrors.length > 0) {
    return { discountId: null, error: userErrors.map((e: { message: string }) => e.message).join("; ") };
  }
  const discountId = data?.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId ?? null;
  return { discountId, error: discountId ? null : "Discount created but ID not returned" };
}

async function updateDiscountConfig(shop: string, token: string, discountId: string, config: string): Promise<string | null> {
  const data = await gqlAdmin(shop, token, `
    mutation UpdateMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }
  `, {
    metafields: [{ ownerId: discountId, namespace: "upsale", key: "config", type: "json", value: config }],
  });
  const errs = data?.data?.metafieldsSet?.userErrors ?? [];
  return errs.length > 0 ? errs.map((e: { message: string }) => e.message).join("; ") : null;
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

  // Sync Shopify Automatic Discount — capture full result for dashboard feedback
  let syncStatus: { status: string; error?: string; discountId?: string; allFunctions?: { id: string; apiType: string }[] } = { status: "skipped" };

  if (!session?.accessToken) {
    syncStatus = { status: "error", error: "No access token — reinstall the app to grant permissions" };
  } else {
    try {
      const validTiers = (body.tiers as PromotionTier[] ?? [])
        .filter(t => t.giftVariantId)
        .map(t => ({ threshold: Number(t.threshold) || 50, giftVariantId: t.giftVariantId }));

      const config = JSON.stringify({ tiers: validTiers });

      if (body.active && validTiers.length > 0) {
        if (existing.discountId) {
          const err = await updateDiscountConfig(shop, session.accessToken, existing.discountId, config);
          syncStatus = err ? { status: "error", error: err } : { status: "updated", discountId: existing.discountId };
        } else {
          const result = await createShopifyDiscount(shop, session.accessToken, config);
          if (result.discountId) {
            await savePromotion(shop, { discountId: result.discountId });
            syncStatus = { status: "created", discountId: result.discountId };
          } else {
            syncStatus = { status: "error", error: result.error ?? "Unknown error" };
          }
        }
      } else if (!body.active && existing.discountId) {
        await deleteShopifyDiscount(shop, session.accessToken, existing.discountId);
        await savePromotion(shop, { discountId: "" });
        syncStatus = { status: "deleted" };
      } else {
        syncStatus = { status: "skipped" };
      }
    } catch (e) {
      syncStatus = { status: "error", error: String(e) };
    }
  }

  return NextResponse.json({ ok: true, syncStatus });
}
