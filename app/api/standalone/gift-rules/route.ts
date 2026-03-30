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
    // 1. Get function UUID from env var (set to the uid in shopify.extension.toml)
      const fnUuidRaw = process.env.SHOPIFY_GIFT_FUNCTION_UUID ?? "";
      if (!fnUuidRaw) {
        syncStatus = { error: "SHOPIFY_GIFT_FUNCTION_UUID env var not set" };
      } else {
        const fnUuid = fnUuidRaw.replace(/^gid:\/\/shopify\/Function\//, "");
        const fnGid = fnUuidRaw.startsWith("gid://shopify/Function/")
          ? fnUuidRaw
          : `gid://shopify/Function/${fnUuid}`;

        // 2. Use cached CartTransform ID from Firebase, or query/create
        let ctId: string | null = await getCartTransformId(session.shop);

        const matchesFn = (functionId: string | null | undefined) =>
          functionId === fnUuid || functionId === fnGid;
      const fetchTransforms = async () => {
        const ctData = await shopifyGraphql(session.shop, session.accessToken!, `
          query { cartTransforms(first: 25) { nodes { id functionId } } }
        `);
        return ctData?.data?.cartTransforms?.nodes ?? [];
      };

      if (!ctId) {
        const transforms = await fetchTransforms();
        const match = transforms.find((t: any) => matchesFn(t.functionId));
        ctId = match?.id ?? null;
        if (ctId) await setCartTransformId(session.shop, ctId);
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
        `, { fnId: fnGid });
        ctId = (createData as any)?.data?.cartTransformCreate?.cartTransform?.id ?? null;
        const userErrors = (createData as any)?.data?.cartTransformCreate?.userErrors ?? [];
        if (!ctId && userErrors.length > 0) {
          const transforms = await fetchTransforms();
          const match = transforms.find((t: any) => matchesFn(t.functionId));
          ctId = match?.id ?? null;
        }
        if (!ctId && userErrors.length > 0) {
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
