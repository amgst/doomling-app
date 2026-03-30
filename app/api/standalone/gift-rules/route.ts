import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { getGiftRules, setGiftRules, getCartTransformId, setCartTransformId, GiftRule } from "@/lib/firebase/giftRuleStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NS = "gwp";
const KEY = "gift_config";
const DEFAULT_FUNCTION_HANDLE = "gift-with-product";

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
    // 1) Prefer function handle (defined in `extensions/gift-with-product/shopify.extension.toml`)
    // NOTE: `extensions[].uid` is NOT a Shopify Function id (gid://shopify/Function/...), it's an extension UID.
    const fnHandle = (process.env.SHOPIFY_GIFT_FUNCTION_HANDLE ?? DEFAULT_FUNCTION_HANDLE).trim();
    const fnIdRaw = (process.env.SHOPIFY_GIFT_FUNCTION_ID ?? "").trim();
    const deprecatedUid = (process.env.SHOPIFY_GIFT_FUNCTION_UUID ?? "").trim();

    if (!fnHandle && !fnIdRaw) {
      syncStatus = {
        error: "No function identifier configured",
        help: {
          recommended: `Set SHOPIFY_GIFT_FUNCTION_HANDLE=${DEFAULT_FUNCTION_HANDLE}`,
          optional: "Or set SHOPIFY_GIFT_FUNCTION_ID to the deployed function gid://shopify/Function/...",
          note: "SHOPIFY_GIFT_FUNCTION_UUID is deprecated; it is the extension UID, not a function id.",
        },
      };
    } else if (deprecatedUid && !fnIdRaw && fnHandle === DEFAULT_FUNCTION_HANDLE) {
      // Surface the common misconfiguration explicitly (extension UID mistaken for function ID)
      syncStatus = {
        warning: "SHOPIFY_GIFT_FUNCTION_UUID is set but ignored",
        note: "This value is an extension UID, not a Shopify Function id. Using function handle instead.",
        using: { functionHandle: fnHandle },
      };
    }

    if (typeof syncStatus === "object" && (syncStatus as any)?.error) {
      // skip
    } else {
      // 2. Use cached CartTransform ID from Firebase, or query/create
      let ctId: string | null = await getCartTransformId(session.shop);

      const fnGid = fnIdRaw
        ? fnIdRaw.startsWith("gid://shopify/Function/")
          ? fnIdRaw
          : `gid://shopify/Function/${fnIdRaw.replace(/^gid:\/\/shopify\/Function\//, "")}`
        : null;

      const matchesFn = (functionId: string | null | undefined) =>
        !!fnGid && (functionId === fnGid || functionId === fnGid.replace(/^gid:\/\/shopify\/Function\//, ""));

      const fetchTransforms = async () => {
        const ctData = await shopifyGraphql(
          session.shop,
          session.accessToken!,
          `
            query GetCTs {
              cartTransforms(first: 25) {
                nodes {
                  id
                  functionId
                  metafield(namespace: "${NS}", key: "${KEY}") { id }
                }
              }
            }
          `,
        );
        return ctData?.data?.cartTransforms?.nodes ?? [];
      };

      if (!ctId) {
        const transforms = await fetchTransforms();
        const matchByMeta = transforms.find((t: any) => !!t?.metafield?.id);
        const matchByFn = transforms.find((t: any) => matchesFn(t.functionId));
        ctId = (matchByMeta?.id ?? matchByFn?.id ?? null) as string | null;
        if (ctId) await setCartTransformId(session.shop, ctId);
      }

      if (!ctId) {
        // Create CartTransform
        const createData = await shopifyGraphql(
          session.shop,
          session.accessToken!,
          fnGid
            ? `
              mutation CreateCT($fnId: String!) {
                cartTransformCreate(functionId: $fnId) {
                  cartTransform { id }
                  userErrors { field message code }
                }
              }
            `
            : `
              mutation CreateCT($fnHandle: String!) {
                cartTransformCreate(functionHandle: $fnHandle) {
                  cartTransform { id }
                  userErrors { field message code }
                }
              }
            `,
          fnGid ? { fnId: fnGid } : { fnHandle },
        );
        ctId = (createData as any)?.data?.cartTransformCreate?.cartTransform?.id ?? null;
        const userErrors = (createData as any)?.data?.cartTransformCreate?.userErrors ?? [];
        if (!ctId && userErrors.length > 0) {
          const transforms = await fetchTransforms();
          const matchByMeta = transforms.find((t: any) => !!t?.metafield?.id);
          const matchByFn = transforms.find((t: any) => matchesFn(t.functionId));
          ctId = (matchByMeta?.id ?? matchByFn?.id ?? null) as string | null;
        }
        if (!ctId && userErrors.length > 0) {
          syncStatus = {
            error: "Could not create CartTransform",
            userErrors,
            using: fnGid ? { functionId: fnGid } : { functionHandle: fnHandle },
            hint:
              "If this says the function was not found, deploy/release the function in THIS app and reinstall the app on the store.",
          };
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
