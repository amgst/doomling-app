import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FUNCTION_HANDLE = "gift-with-product";
const NS = "upsale";
const KEY = "gift_config";

async function shopifyGraphql(shop: string, accessToken: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
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

async function findFunctionId(shop: string, accessToken: string): Promise<{ id: string | null; allHandles: string[]; rawResponse?: unknown }> {
  const raw = await shopifyGraphql(shop, accessToken, `
    query { shopifyFunctions(first: 25) { nodes { id title apiType } } }
  `);
  const nodes: { id: string; title: string; apiType: string }[] = raw?.data?.shopifyFunctions?.nodes ?? [];
  const allTitles = nodes.map((n) => `${n.title} (${n.apiType})`);
  const match =
    nodes.find((n) => n.title === "Gift With Product") ??
    nodes.find((n) => n.title.toLowerCase().includes("gift"));
  // Construct full GID — shopifyFunctions returns a raw UUID, not a prefixed GID
  const id = match ? (match.id.startsWith("gid://") ? match.id : `gid://shopify/ShopifyFunction/${match.id}`) : null;
  return { id, allHandles: allTitles, rawResponse: raw };
}

export interface GiftRule {
  mainVariantId: string;
  giftVariantId: string;
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: fnId, allHandles, rawResponse } = await findFunctionId(session.shop, session.accessToken!);
  if (!fnId) return NextResponse.json({ rules: [], debug: { message: "Function not found", allHandles, rawResponse } });

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

  const writtenIds = data?.data?.metafieldsSet?.metafields ?? [];
  if (writtenIds.length === 0) {
    // Mutation returned no userErrors but also wrote nothing — surface raw response
    return NextResponse.json({ error: "Metafield write returned no result", debug: data }, { status: 500 });
  }

  // Read back immediately to confirm persistence
  const readBack = await shopifyGraphql(session.shop, session.accessToken!, `
    query GetMeta($id: ID!) {
      node(id: $id) {
        ... on ShopifyFunction {
          metafield(namespace: "${NS}", key: "${KEY}") { value }
        }
      }
    }
  `, { id: fnId });

  const readValue = readBack?.data?.node?.metafield?.value;
  return NextResponse.json({ ok: true, rules: body.rules, debug: { writtenIds, readBack: readValue } });
}
