import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FUNCTION_TITLE = "Gift With Product";
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

/**
 * Cart Transform functions store their config on a CartTransform object,
 * not directly on the ShopifyFunction. We find or create that CartTransform
 * and use its GID as the metafield owner.
 */
async function findOrCreateCartTransformId(
  shop: string,
  accessToken: string
): Promise<{ id: string | null; debug?: unknown }> {
  // 1. Find the ShopifyFunction UUID
  const fnData = await shopifyGraphql(shop, accessToken, `
    query { shopifyFunctions(first: 25) { nodes { id title } } }
  `);
  const fns: { id: string; title: string }[] = fnData?.data?.shopifyFunctions?.nodes ?? [];
  const fn =
    fns.find((f) => f.title === FUNCTION_TITLE) ??
    fns.find((f) => f.title.toLowerCase().includes("gift"));

  if (!fn) return { id: null, debug: { step: "function_not_found", fns, raw: fnData } };

  const fnGid = fn.id.startsWith("gid://")
    ? fn.id
    : `gid://shopify/ShopifyFunction/${fn.id}`;

  // 2. Find existing CartTransform for this function
  const ctData = await shopifyGraphql(shop, accessToken, `
    query { cartTransforms(first: 25) { nodes { id functionId } } }
  `);
  const transforms: { id: string; functionId: string }[] =
    ctData?.data?.cartTransforms?.nodes ?? [];
  const existing = transforms.find(
    (t) => t.functionId === fnGid || t.functionId?.includes(fn.id)
  );

  if (existing) return { id: existing.id };

  // 3. No CartTransform exists yet — create one
  const createData = await shopifyGraphql(shop, accessToken, `
    mutation CreateCT($fnId: ID!) {
      cartTransformCreate(functionId: $fnId) {
        cartTransform { id functionId }
        userErrors { field message code }
      }
    }
  `, { fnId: fnGid });

  const created = createData?.data?.cartTransformCreate?.cartTransform;
  const createErrors = createData?.data?.cartTransformCreate?.userErrors ?? [];

  if (!created || createErrors.length > 0) {
    return { id: null, debug: { step: "create_failed", createErrors, raw: createData } };
  }

  return { id: created.id };
}

export interface GiftRule {
  mainVariantId: string;
  giftVariantId: string;
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: ctId, debug } = await findOrCreateCartTransformId(session.shop, session.accessToken!);
  if (!ctId) return NextResponse.json({ rules: [], debug });

  const data = await shopifyGraphql(session.shop, session.accessToken!, `
    query GetMeta($id: ID!) {
      node(id: $id) {
        ... on CartTransform {
          metafield(namespace: "${NS}", key: "${KEY}") { value }
        }
      }
    }
  `, { id: ctId });

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

  const { id: ctId, debug } = await findOrCreateCartTransformId(session.shop, session.accessToken!);
  if (!ctId) {
    return NextResponse.json({ error: "Could not find or create CartTransform", debug }, { status: 500 });
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
  `, { ownerId: ctId, value });

  const errors: { field: string; message: string }[] =
    data?.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message }, { status: 400 });
  }

  const written = data?.data?.metafieldsSet?.metafields ?? [];
  if (written.length === 0) {
    return NextResponse.json({ error: "Write returned no result", debug: data }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rules: body.rules });
}
