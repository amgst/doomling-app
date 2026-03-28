import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";

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

export interface GiftRule {
  mainVariantId: string;
  giftVariantId: string;
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await shopifyGraphql(session.shop, session.accessToken!, `
    query {
      shop {
        metafield(namespace: "${NS}", key: "${KEY}") { value }
      }
    }
  `);

  const raw: string | undefined = data?.data?.shop?.metafield?.value;
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

  const shopData = await shopifyGraphql(session.shop, session.accessToken!, `query { shop { id } }`);
  const shopId: string | undefined = shopData?.data?.shop?.id;
  if (!shopId) return NextResponse.json({ error: "Could not get Shop ID" }, { status: 500 });

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

  const errors: { field: string; message: string }[] = data?.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message }, { status: 400 });
  }

  const written = data?.data?.metafieldsSet?.metafields ?? [];
  if (written.length === 0) {
    return NextResponse.json({ error: "Metafield write failed", details: data?.errors ?? null }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rules: body.rules });
}
