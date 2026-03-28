import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/utils/verifyRequest";
import { getShopify } from "@/lib/shopify/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FUNCTION_TITLE = "Gift With Product";
const NS = "upsale";
const KEY = "gift_config";

async function findOrCreateCartTransformId(client: { request: <T>(query: string, opts?: { variables?: Record<string, unknown> }) => Promise<{ data?: T }> }): Promise<{ id: string | null; debug?: unknown }> {
  // 1. Find the ShopifyFunction UUID
  const fnData = await client.request<{ shopifyFunctions: { nodes: { id: string; title: string }[] } }>(
    `query { shopifyFunctions(first: 25) { nodes { id title } } }`
  );
  const fns = fnData.data?.shopifyFunctions?.nodes ?? [];
  const fn =
    fns.find((f) => f.title === FUNCTION_TITLE) ??
    fns.find((f) => f.title.toLowerCase().includes("gift"));

  if (!fn) return { id: null, debug: { step: "function_not_found", fns } };

  const fnGid = fn.id.startsWith("gid://")
    ? fn.id
    : `gid://shopify/ShopifyFunction/${fn.id}`;

  // 2. Find existing CartTransform for this function
  const ctData = await client.request<{ cartTransforms: { nodes: { id: string; functionId: string }[] } }>(
    `query { cartTransforms(first: 25) { nodes { id functionId } } }`
  );
  const transforms = ctData.data?.cartTransforms?.nodes ?? [];
  const existing = transforms.find(
    (t) => t.functionId === fnGid || t.functionId?.includes(fn.id)
  );

  if (existing) return { id: existing.id };

  // 3. No CartTransform exists — create one
  const createData = await client.request<{
    cartTransformCreate: {
      cartTransform: { id: string; functionId: string } | null;
      userErrors: { field: string; message: string; code: string }[];
    };
  }>(
    `mutation CreateCT($fnId: String!) {
      cartTransformCreate(functionId: $fnId) {
        cartTransform { id functionId }
        userErrors { field message code }
      }
    }`,
    { variables: { fnId: fnGid } }
  );

  const created = createData.data?.cartTransformCreate?.cartTransform;
  const createErrors = createData.data?.cartTransformCreate?.userErrors ?? [];

  if (!created || createErrors.length > 0) {
    return { id: null, debug: { step: "create_failed", createErrors } };
  }

  return { id: created.id };
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

  const { id: ctId, debug } = await findOrCreateCartTransformId(client);
  if (!ctId) return NextResponse.json({ rules: [], debug });

  const res = await client.request<{ node: { metafield?: { value: string } } }>(
    `query GetMeta($id: ID!) {
      node(id: $id) {
        ... on CartTransform {
          metafield(namespace: "${NS}", key: "${KEY}") { value }
        }
      }
    }`,
    { variables: { id: ctId } }
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

  const { id: ctId, debug } = await findOrCreateCartTransformId(client);
  if (!ctId) {
    return NextResponse.json({ error: "Could not find or create CartTransform", debug }, { status: 500 });
  }

  const value = JSON.stringify({ rules: body.rules });

  const res = await client.request<{ metafieldsSet: { metafields: { id: string }[]; userErrors: { field: string; message: string }[] } }>(
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
    { variables: { ownerId: ctId, value } }
  );

  const errors = res.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message }, { status: 400 });
  }

  const written = res.data?.metafieldsSet?.metafields ?? [];
  if (written.length === 0) {
    return NextResponse.json({ error: "Write returned no result", debug: res }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rules: body.rules });
}
