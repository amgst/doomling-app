import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FUNCTION_TITLE = "Gift With Product";
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

async function findOrCreateCartTransformId(
  shop: string,
  accessToken: string
): Promise<{ id: string | null; source: string; debug?: unknown }> {
  // 1. Find the ShopifyFunction UUID
  const fnData = await shopifyGraphql(shop, accessToken, `
    query { shopifyFunctions(first: 25) { nodes { id title } } }
  `);
  const fns: { id: string; title: string }[] = fnData?.data?.shopifyFunctions?.nodes ?? [];
  const fn =
    fns.find((f) => f.title === FUNCTION_TITLE) ??
    fns.find((f) => f.title.toLowerCase().includes("gift"));

  if (!fn) return { id: null, source: "fn_not_found", debug: { fns, fnErrors: fnData?.errors } };

  const fnGid = fn.id.startsWith("gid://")
    ? fn.id
    : `gid://shopify/ShopifyFunction/${fn.id}`;

  // 2. Find existing CartTransform (Shopify only returns this app's transforms)
  const ctData = await shopifyGraphql(shop, accessToken, `
    query { cartTransforms(first: 10) { nodes { id } } }
  `);
  const ctErrors = ctData?.errors ?? null;
  const transforms: { id: string }[] = ctData?.data?.cartTransforms?.nodes ?? [];

  if (transforms.length > 0) return { id: transforms[0].id, source: "found_existing" };

  // 3. No CartTransform found — try to create one
  const createData = await shopifyGraphql(shop, accessToken, `
    mutation CreateCT($fnId: String!) {
      cartTransformCreate(functionId: $fnId) {
        cartTransform { id }
        userErrors { field message code }
      }
    }
  `, { fnId: fnGid });

  const created = createData?.data?.cartTransformCreate?.cartTransform;
  const createErrors = createData?.data?.cartTransformCreate?.userErrors ?? [];
  const createTopErrors = createData?.errors ?? null;

  if (!created) {
    return {
      id: null,
      source: "create_failed",
      debug: { fnGid, ctErrors, ctNodes: transforms, createErrors, createTopErrors },
    };
  }

  return { id: created.id, source: "created_new" };
}

export interface GiftRule {
  mainVariantId: string;
  giftVariantId: string;
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: ctId, source, debug } = await findOrCreateCartTransformId(session.shop, session.accessToken!);
  if (!ctId) return NextResponse.json({ rules: [], ctSource: source, debug });

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

  const { id: ctId, source: ctSource, debug: ctDebug } = await findOrCreateCartTransformId(session.shop, session.accessToken!);
  if (!ctId) {
    return NextResponse.json({ error: "Could not find or create CartTransform", ctSource, debug: ctDebug }, { status: 500 });
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
        metafields { id namespace key }
        userErrors { field message code }
      }
    }
  `, { ownerId: ctId, value });

  const errors: { field: string; message: string }[] =
    data?.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message, ctId, ctSource }, { status: 400 });
  }

  const written = data?.data?.metafieldsSet?.metafields ?? [];
  if (written.length === 0) {
    return NextResponse.json({
      error: "Metafield write returned no result",
      ctId,
      ctSource,
      topLevelErrors: data?.errors ?? null,
      mutationResponse: data?.data?.metafieldsSet ?? null,
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rules: body.rules });
}
