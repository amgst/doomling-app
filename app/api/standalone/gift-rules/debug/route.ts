import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { getGiftRules, getCartTransformId } from "@/lib/firebase/giftRuleStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NS = "gwp";
const KEY = "gift_config";

async function shopifyGraphql(shop: string, accessToken: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify GraphQL HTTP ${res.status}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  if (!session?.accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

  const firebaseRules = await getGiftRules(shop);
  const cachedCtId = await getCartTransformId(shop);

  const ctData = await shopifyGraphql(shop, session.accessToken, `
    query {
      cartTransforms(first: 10) { nodes { id } }
    }
  `);
  const transforms = ctData?.data?.cartTransforms?.nodes ?? [];

  let metafieldValue: string | null = null;
  let metafieldParsed: unknown = null;
  let metafieldParseError: string | null = null;

  const ctId = cachedCtId || transforms?.[0]?.id || null;
  if (ctId) {
    const metaData = await shopifyGraphql(shop, session.accessToken, `
      query GetMeta($id: ID!) {
        cartTransform(id: $id) {
          id
          metafield(namespace: "${NS}", key: "${KEY}") { value }
        }
      }
    `, { id: ctId });
    metafieldValue = metaData?.data?.cartTransform?.metafield?.value ?? null;
    if (metafieldValue) {
      try {
        metafieldParsed = JSON.parse(metafieldValue);
      } catch (e) {
        metafieldParseError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  return NextResponse.json({
    shop,
    cachedCtId,
    transforms,
    metafieldValue,
    metafieldParsed,
    metafieldParseError,
    firebaseRules,
    env: {
      SHOPIFY_GIFT_FUNCTION_UUID: process.env.SHOPIFY_GIFT_FUNCTION_UUID ?? null,
    },
  });
}
