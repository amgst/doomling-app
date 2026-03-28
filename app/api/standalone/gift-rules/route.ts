import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FUNCTION_HANDLE = "gift-with-product";
const NS = "upsale";
const KEY = "gift_config";

async function shopifyGraphql(shop: string, accessToken: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
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

async function findFunctionId(shop: string, accessToken: string): Promise<{ id: string | null; allHandles: string[] }> {
  const data = await shopifyGraphql(shop, accessToken, `
    query { shopifyFunctions(first: 25) { nodes { id handle apiType } } }
  `);
  const nodes: { id: string; handle: string; apiType: string }[] = data?.data?.shopifyFunctions?.nodes ?? [];
  const allHandles = nodes.map((n) => n.handle);
  // Try exact match first, then partial match (handle contains our name)
  const match =
    nodes.find((n) => n.handle === FUNCTION_HANDLE) ??
    nodes.find((n) => n.handle.includes("gift"));
  return { id: match?.id ?? null, allHandles };
}

export interface GiftRule {
  mainVariantId: string;
  giftVariantId: string;
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: fnId, allHandles } = await findFunctionId(session.shop, session.accessToken!);
  if (!fnId) return NextResponse.json({ rules: [], debug: { message: "Function not found", allHandles } });

  const data = await shopifyGraphql(session.shop, session.accessToken!, `
    query GetMeta($id: ID!) {
      node(id: $id) {
        ... on ShopifyFunction {
          metafield(namespace: "${NS}", key: "${KEY}") { value }
        }
      }
    }
  `, { id: fnId });

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

  const { id: fnId, allHandles } = await findFunctionId(session.shop, session.accessToken!);
  if (!fnId) {
    return NextResponse.json(
      { error: `Function not found. Available handles: ${allHandles.join(", ") || "none"}` },
      { status: 404 }
    );
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
  `, { ownerId: fnId, value });

  const errors: { field: string; message: string }[] = data?.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, rules: body.rules });
}
