import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { getGiftRules, setGiftRules, GiftRule } from "@/lib/firebase/giftRuleStore";

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

  const rules = await getGiftRules(session.shop);
  return NextResponse.json({ rules });
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

  // Save to Firebase (source of truth for dashboard)
  await setGiftRules(session.shop, body.rules);

  // Sync to Shopify metafield so the cart function can read it
  let syncStatus: unknown = "not_attempted";
  try {
    const shopData = await shopifyGraphql(session.shop, session.accessToken!, `query { shop { id } }`);
    const shopId: string | undefined = shopData?.data?.shop?.id;
    if (shopId) {
      const value = JSON.stringify({ rules: body.rules });
      const syncData = await shopifyGraphql(session.shop, session.accessToken!, `
        mutation SetMeta($ownerId: ID!, $value: String!) {
          metafieldsSet(metafields: [{
            ownerId: $ownerId
            namespace: "${NS}"
            key: "${KEY}"
            type: "json"
            value: $value
          }]) {
            metafields { id namespace key }
            userErrors { field message }
          }
        }
      `, { ownerId: shopId, value });
      syncStatus = {
        shopId,
        metafields: syncData?.data?.metafieldsSet?.metafields ?? [],
        userErrors: syncData?.data?.metafieldsSet?.userErrors ?? [],
        topErrors: syncData?.errors ?? null,
      };
    }
  } catch (e) {
    syncStatus = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ ok: true, rules: body.rules, sync: syncStatus });
}
