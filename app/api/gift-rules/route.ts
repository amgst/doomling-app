import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/utils/verifyRequest";
import { getShopify } from "@/lib/shopify/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FUNCTION_HANDLE = "gift-with-product";
const NS = "upsale";
const KEY = "gift_config";

async function findFunctionId(client: InstanceType<ReturnType<typeof getShopify>["clients"]["Graphql"]>): Promise<string | null> {
  const res = await client.request<{ shopifyFunctions: { nodes: { id: string; title: string }[] } }>(
    `query { shopifyFunctions(first: 25) { nodes { id title } } }`
  );
  const nodes = res.data?.shopifyFunctions?.nodes ?? [];
  const node =
    nodes.find((n) => n.title === "Gift With Product") ??
    nodes.find((n) => n.title.toLowerCase().includes("gift"));
  if (!node) return null;
  return node.id.startsWith("gid://") ? node.id : `gid://shopify/ShopifyFunction/${node.id}`;
}

export interface GiftRule {
  mainVariantId: string;
  giftVariantId: string;
}

export async function GET(req: NextRequest) {
  const { session, errorResponse } = await verifyRequest(req);
  if (errorResponse) return errorResponse;

  const shopify = getShopify();
  const client = new shopify.clients.Graphql({ session: session! });

  const fnId = await findFunctionId(client);
  if (!fnId) return NextResponse.json({ rules: [] });

  const res = await client.request<{ node: { metafield?: { value: string } } }>(
    `query GetMeta($id: ID!) {
      node(id: $id) {
        ... on ShopifyFunction {
          metafield(namespace: "${NS}", key: "${KEY}") { value }
        }
      }
    }`,
    { variables: { id: fnId } }
  );

  const raw = res.data?.node?.metafield?.value;
  let rules: GiftRule[] = [];
  if (raw) {
    try { rules = JSON.parse(raw).rules ?? []; } catch { /* ignore */ }
  }

  return NextResponse.json({ rules });
}

export async function PUT(req: NextRequest) {
  const { session, errorResponse } = await verifyRequest(req);
  if (errorResponse) return errorResponse;

  let body: { rules: GiftRule[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const shopify = getShopify();
  const client = new shopify.clients.Graphql({ session: session! });

  const fnId = await findFunctionId(client);
  if (!fnId) {
    return NextResponse.json(
      { error: "Function 'gift-with-product' not found. Make sure the extension is deployed." },
      { status: 404 }
    );
  }

  const value = JSON.stringify({ rules: body.rules });

  const res = await client.request<{ metafieldsSet: { userErrors: { field: string; message: string }[] } }>(
    `mutation SetMeta($ownerId: ID!, $value: String!) {
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
    }`,
    { variables: { ownerId: fnId, value } }
  );

  const errors = res.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, rules: body.rules });
}
