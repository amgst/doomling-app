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
    // 0. Check which app this access token belongs to
    const appData = await shopifyGraphql(session.shop, session.accessToken!, `
      query { currentAppInstallation { app { id apiKey title } } }
    `);
    const tokenAppInfo = appData?.data?.currentAppInstallation?.app ?? null;

    // 1. Find the ShopifyFunction belonging to THIS app by apiKey
    const fnData = await shopifyGraphql(session.shop, session.accessToken!, `
      query { shopifyFunctions(first: 25) { nodes { id title app { apiKey } } } }
    `);
    const fns: { id: string; title: string; app: { apiKey: string } }[] = fnData?.data?.shopifyFunctions?.nodes ?? [];
    const ourApiKey = process.env.SHOPIFY_API_KEY ?? "";
    // Only consider functions that belong to our app
    const ourFns = ourApiKey ? fns.filter((f) => f.app?.apiKey === ourApiKey) : fns;
    const fn = ourFns.find((f) => f.title === "Gift With Product") ?? ourFns.find((f) => f.title.toLowerCase().includes("gift"));
    // Debug: include all found functions in error output
    const fnDebug = { tokenAppInfo, ourApiKey, allFns: fns, ourFns };

    if (!fn) {
      syncStatus = { error: "ShopifyFunction not found", ...fnDebug };
    } else {
      const fnGid = fn.id.startsWith("gid://") ? fn.id : `gid://shopify/ShopifyFunction/${fn.id}`;
      // Also try plain UUID in case GID format is wrong
      const fnUuid = fn.id.replace(/^gid:\/\/shopify\/ShopifyFunction\//, "");

      // Verify the GID is resolvable
      const nodeData = await shopifyGraphql(session.shop, session.accessToken!, `
        query CheckNode($id: ID!) { node(id: $id) { id __typename } }
      `, { id: fnGid });

      // 2. Find existing CartTransform
      const ctData = await shopifyGraphql(session.shop, session.accessToken!, `
        query { cartTransforms(first: 10) { nodes { id } } }
      `);
      const transforms: { id: string }[] = ctData?.data?.cartTransforms?.nodes ?? [];
      let ctId: string | null = transforms[0]?.id ?? null;

      // 3. Create CartTransform if none exists
      let createData: Record<string, unknown> | null = null;
      let createDataUuid: Record<string, unknown> | null = null;
      if (!ctId) {
        // Try with full GID first
        createData = await shopifyGraphql(session.shop, session.accessToken!, `
          mutation CreateCT($fnId: String!) {
            cartTransformCreate(functionId: $fnId) {
              cartTransform { id }
              userErrors { field message }
            }
          }
        `, { fnId: fnGid });
        ctId = (createData as any)?.data?.cartTransformCreate?.cartTransform?.id ?? null;

        // If GID failed, try plain UUID
        if (!ctId) {
          createDataUuid = await shopifyGraphql(session.shop, session.accessToken!, `
            mutation CreateCT2($fnId: String!) {
              cartTransformCreate(functionId: $fnId) {
                cartTransform { id }
                userErrors { field message }
              }
            }
          `, { fnId: fnUuid });
          ctId = (createDataUuid as any)?.data?.cartTransformCreate?.cartTransform?.id ?? null;
        }
      }

      if (!ctId) {
        syncStatus = {
          error: "Could not find or create CartTransform",
          fnGid,
          fnUuid,
          nodeCheck: nodeData?.data?.node ?? null,
          ...fnDebug,
          ctQuery: ctData,
          transforms,
          createDataGid: createData,
          createDataUuid,
          createErrorsGid: (createData as any)?.data?.cartTransformCreate?.userErrors ?? null,
          createErrorsUuid: (createDataUuid as any)?.data?.cartTransformCreate?.userErrors ?? null,
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
