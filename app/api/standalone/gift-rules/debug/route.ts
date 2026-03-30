import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { getGiftRules, getCartTransformId } from "@/lib/firebase/giftRuleStore";

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

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  if (!session?.accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

  const firebaseRules = await getGiftRules(shop);
  const cachedCtId = await getCartTransformId(shop);

  const fnUuidRaw = process.env.SHOPIFY_GIFT_FUNCTION_UUID ?? null;

  const ctData = await shopifyGraphql(shop, session.accessToken, `
    query {
      cartTransforms(first: 25) { nodes { id functionId } }
    }
  `);
  const transforms = ctData?.data?.cartTransforms?.nodes ?? [];

  let metafieldValue: string | null = null;
  let metafieldParsed: unknown = null;
  let metafieldParseError: string | null = null;

  const fnUuid = fnUuidRaw?.replace(/^gid:\/\/shopify\/Function\//, "");
  const fnGid = fnUuidRaw && fnUuidRaw.startsWith("gid://shopify/Function/")
    ? fnUuidRaw
    : fnUuidRaw
      ? `gid://shopify/Function/${fnUuid}`
      : null;

  const matchesFn = (functionId: string | null | undefined) =>
    fnUuid && fnGid
      ? functionId === fnUuid || functionId === fnGid
      : false;

  const matchedTransform = transforms.find((t: any) => matchesFn(t.functionId));
  const ctId = cachedCtId || matchedTransform?.id || null;
  if (ctId) {
    const metaData = await shopifyGraphql(shop, session.accessToken, `
      query GetMeta($id: ID!) {
        cartTransform(id: $id) {
          id
          metafield(namespace: "${NS}", key: "${KEY}") { value }
        }
      }
    `, { id: ctId });
    metafieldValue = metaData?.data?.cartTransform?.metafield?.value ?? null;
    if (metafieldValue) {
      try {
        metafieldParsed = JSON.parse(metafieldValue);
      } catch (e) {
        metafieldParseError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  // Attempt a dry-run create to see the exact Shopify error (won't commit if it succeeds,
  // because we immediately delete it — but this surfaces "Function not found" errors clearly)
  let createAttempt: unknown = "skipped (no fnGid)";
  if (fnGid && !ctId) {
    const createData = await shopifyGraphql(shop, session.accessToken, `
      mutation TryCreate($fnId: String!) {
        cartTransformCreate(functionId: $fnId) {
          cartTransform { id functionId }
          userErrors { field message code }
        }
      }
    `, { fnId: fnGid });
    const created = createData?.data?.cartTransformCreate?.cartTransform;
    const userErrors = createData?.data?.cartTransformCreate?.userErrors ?? [];
    createAttempt = {
      result: created ? "created" : "failed",
      cartTransform: created ?? null,
      userErrors,
      topErrors: createData?.errors ?? null,
    };
    // Clean up the test-created transform immediately
    if (created?.id) {
      await shopifyGraphql(shop, session.accessToken, `
        mutation Del($id: ID!) { cartTransformDelete(id: $id) { deletedId } }
      `, { id: created.id });
    }
  } else if (ctId) {
    createAttempt = "skipped (ctId already exists: " + ctId + ")";
  }

  return NextResponse.json({
    shop,
    cachedCtId,
    fnUuid,
    fnGid,
    transforms,
    createAttempt,
    metafieldValue,
    metafieldParsed,
    metafieldParseError,
    firebaseRules,
    env: {
      SHOPIFY_GIFT_FUNCTION_UUID: process.env.SHOPIFY_GIFT_FUNCTION_UUID ?? null,
    },
  });
}
