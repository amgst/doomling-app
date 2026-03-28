import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NS = "upsale";
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

async function getShopId(shop: string, accessToken: string): Promise<string | null> {
  const data = await shopifyGraphql(shop, accessToken, `query { shop { id } }`);
  return data?.data?.shop?.id ?? null;
}

export interface GiftRule {
  mainVariantId: string;
  giftVariantId: string;
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shopId = await getShopId(session.shop, session.accessToken!);
  if (!shopId) return NextResponse.json({ rules: [] });

  const data = await shopifyGraphql(session.shop, session.accessToken!, `
    query GetMeta($id: ID!) {
      node(id: $id) {
        ... on Shop {
          metafield(namespace: "${NS}", key: "${KEY}") { value }
        }
      }
    }
  `, { id: shopId });

  const raw: string | undefined = data?.data?.node?.metafield?.value;
  let rules: GiftRule[] = [];
  if (raw) {
    try { rules = JSON.parse(raw).rules ?? []; } catch { /* ignore */ }
  }

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

  const shopId = await getShopId(session.shop, session.accessToken!);
  if (!shopId) {
    return NextResponse.json({ error: "Could not get Shop ID" }, { status: 500 });
  }

  const value = JSON.stringify({ rules: body.rules });
  const data = await shopifyGraphql(session.shop, session.accessToken!, `
    mutation SetMeta($ownerId: ID!, $value: String!) {
      metafieldsSet(metafields: [{
        ownerId: $ownerId
        namespace: "${NS}"
        key: "${KEY}"
        type: "json"
        value: $value
      }]) {
        metafields { id }
        userErrors { field message }
      }
    }
  `, { ownerId: shopId, value });

  const errors: { field: string; message: string }[] =
    data?.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message }, { status: 400 });
  }

  const written = data?.data?.metafieldsSet?.metafields ?? [];
  if (written.length === 0) {
    return NextResponse.json({
      error: "Metafield write returned no result",
      topLevelErrors: data?.errors ?? null,
      shopId,
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rules: body.rules });
}
