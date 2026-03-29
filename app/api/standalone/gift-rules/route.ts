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

  // Sync config to CartTransform metafield so the cart function can read it
  let syncStatus: unknown = "not_attempted";
  try {
    // 1. Find the ShopifyFunction by title
    const fnData = await shopifyGraphql(session.shop, session.accessToken!, `
      query { shopifyFunctions(first: 25) { nodes { id title } } }
    `);
    const fns: { id: string; title: string }[] = fnData?.data?.shopifyFunctions?.nodes ?? [];
    const fn = fns.find((f) => f.title === "Gift With Product") ?? fns.find((f) => f.title.toLowerCase().includes("gift"));

    if (!fn) {
      syncStatus = { error: "ShopifyFunction not found", fns };
    } else {
      const fnGid = fn.id.startsWith("gid://") ? fn.id : `gid://shopify/ShopifyFunction/${fn.id}`;

      // 2. Find existing CartTransform
      const ctData = await shopifyGraphql(session.shop, session.accessToken!, `
        query { cartTransforms(first: 10) { nodes { id } } }
      `);
      const transforms: { id: string }[] = ctData?.data?.cartTransforms?.nodes ?? [];
      let ctId: string | null = transforms[0]?.id ?? null;

      // 3. Create CartTransform if none exists
      let createData: Record<string, unknown> | null = null;
      if (!ctId) {
        createData = await shopifyGraphql(session.shop, session.accessToken!, `
          mutation CreateCT($fnId: String!) {
            cartTransformCreate(functionId: $fnId) {
              cartTransform { id }
              userErrors { field message }
            }
          }
        `, { fnId: fnGid });
        ctId = (createData as any)?.data?.cartTransformCreate?.cartTransform?.id ?? null;
      }

      if (!ctId) {
        syncStatus = {
          error: "Could not find or create CartTransform",
          fnGid,
          ctQuery: ctData,
          transforms,
          createData,
          createErrors: (createData as any)?.data?.cartTransformCreate?.userErrors ?? null,
          createTopErrors: (createData as any)?.errors ?? null,
        };
      } else {
        // 4. Write config to CartTransform metafield
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
              metafields { id }
              userErrors { field message }
            }
          }
        `, { ownerId: ctId, value });
        syncStatus = {
          ctId,
          metafields: syncData?.data?.metafieldsSet?.metafields ?? [],
          userErrors: syncData?.data?.metafieldsSet?.userErrors ?? [],
          topErrors: syncData?.errors ?? null,
        };
      }
    }
  } catch (e) {
    syncStatus = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ ok: true, rules: body.rules, sync: syncStatus });
}
