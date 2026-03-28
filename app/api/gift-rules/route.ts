import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/utils/verifyRequest";
import { getShopify } from "@/lib/shopify/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NS = "upsale";
const KEY = "gift_config";

export interface GiftRule {
  mainVariantId: string;
  giftVariantId: string;
}

export async function GET(req: NextRequest) {
  const { session, errorResponse } = await verifyRequest(req);
  if (errorResponse) return errorResponse;

  const shopify = getShopify();
  const client = new shopify.clients.Graphql({ session: session! });

  const res = await client.request<{ shop: { metafield?: { value: string } } }>(
    `query {
      shop {
        metafield(namespace: "${NS}", key: "${KEY}") { value }
      }
    }`
  );

  const raw = res.data?.shop?.metafield?.value;
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

  const shopRes = await client.request<{ shop: { id: string } }>(`query { shop { id } }`);
  const shopId = shopRes.data?.shop?.id;
  if (!shopId) {
    return NextResponse.json({ error: "Could not get Shop ID" }, { status: 500 });
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
    { variables: { ownerId: shopId, value } }
  );

  const errors = res.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, rules: body.rules });
}
