import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { getGiftRules, setGiftRules, getCartTransformId, setCartTransformId, GiftRule } from "@/lib/firebase/giftRuleStore";

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
    // 1. Find the gift-with-product ShopifyFunction for this app
    const fnData = await shopifyGraphql(session.shop, session.accessToken!, `
      query { shopifyFunctions(first: 25) { nodes { id title app { apiKey } } } }
    `);
    const fns: { id: string; title: string; app: { apiKey: string } }[] = fnData?.data?.shopifyFunctions?.nodes ?? [];
    const ourApiKey = process.env.SHOPIFY_API_KEY ?? "";
    const ourFns = ourApiKey ? fns.filter((f) => f.app?.apiKey === ourApiKey) : fns;
    const fn = ourFns.find((f) => f.title === "Gift With Product") ?? ourFns.find((f) => f.title.toLowerCase().includes("gift"));

    if (!fn) {
      syncStatus = { error: "ShopifyFunction not found", fns };
    } else {
      // Use plain UUID — cartTransformCreate expects UUID, not GID
      const fnUuid = fn.id.replace(/^gid:\/\/shopify\/ShopifyFunction\//, "");

      // 2. Use cached CartTransform ID from Firebase, or query/create
      let ctId: string | null = await getCartTransformId(session.shop);

      if (!ctId) {
        // Try Shopify query first
        const ctData = await shopifyGraphql(session.shop, session.accessToken!, `
          query { cartTransforms(first: 10) { nodes { id } } }
        `);
        ctId = ctData?.data?.cartTransforms?.nodes?.[0]?.id ?? null;
      }

      if (!ctId) {
        // Create CartTransform
        const createData = await shopifyGraphql(session.shop, session.accessToken!, `
          mutation CreateCT($fnId: String!) {
            cartTransformCreate(functionId: $fnId) {
              cartTransform { id }
              userErrors { field message }
            }
          }
        `, { fnId: fnUuid });
        ctId = (createData as any)?.data?.cartTransformCreate?.cartTransform?.id ?? null;
        const userErrors = (createData as any)?.data?.cartTransformCreate?.userErrors ?? [];
        // "already registered" means it exists — still a success, but we can't get the ID this way
        if (!ctId && userErrors.some((e: any) => e.message?.includes("already registered"))) {
          syncStatus = { error: "CartTransform already exists but ID unknown. Re-save to retry after clearing cache." };
        } else if (!ctId) {
          syncStatus = { error: "Could not create CartTransform", userErrors };
        }
        if (ctId) await setCartTransformId(session.shop, ctId);
      }

      if (ctId) {
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
