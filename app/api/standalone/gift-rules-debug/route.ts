import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { getGiftRules, getCartTransformId } from "@/lib/firebase/giftRuleStore";

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

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  if (!session?.accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

  const firebaseRules = await getGiftRules(shop);
  const cachedCtId = await getCartTransformId(shop);

  const fnHandle = (process.env.SHOPIFY_GIFT_FUNCTION_HANDLE ?? DEFAULT_FUNCTION_HANDLE).trim();
  const fnIdRaw = (process.env.SHOPIFY_GIFT_FUNCTION_ID ?? "").trim();
  const deprecatedUid = (process.env.SHOPIFY_GIFT_FUNCTION_UUID ?? "").trim();
  const fnGid = fnIdRaw
    ? fnIdRaw.startsWith("gid://shopify/Function/")
      ? fnIdRaw
      : `gid://shopify/Function/${fnIdRaw.replace(/^gid:\/\/shopify\/Function\//, "")}`
    : null;

  const ctData = await shopifyGraphql(
    shop,
    session.accessToken,
    `
      query {
        cartTransforms(first: 25) {
          nodes {
            id
            functionId
            metafield(namespace: "${NS}", key: "${KEY}") { value }
          }
        }
      }
    `,
  );
  const transforms = ctData?.data?.cartTransforms?.nodes ?? [];

  const matchesFn = (functionId: string | null | undefined) =>
    !!fnGid && (functionId === fnGid || functionId === fnGid.replace(/^gid:\/\/shopify\/Function\//, ""));

  const matchedByFn = transforms.find((t: any) => matchesFn(t.functionId));
  const matchedByMeta = transforms.find((t: any) => !!t?.metafield?.value);
  const ctId = cachedCtId || matchedByMeta?.id || matchedByFn?.id || null;

  let metafieldValue: string | null = null;
  let metafieldParsed: unknown = null;
  let metafieldParseError: string | null = null;

  if (ctId) {
    const metaData = await shopifyGraphql(
      shop,
      session.accessToken,
      `
        query GetMeta($id: ID!) {
          cartTransform(id: $id) {
            id
            metafield(namespace: "${NS}", key: "${KEY}") { value }
          }
        }
      `,
      { id: ctId },
    );
    metafieldValue = metaData?.data?.cartTransform?.metafield?.value ?? null;
    if (metafieldValue) {
      try {
        metafieldParsed = JSON.parse(metafieldValue);
      } catch (e) {
        metafieldParseError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  // Dry-run create to surface "Function not found" errors (cleaned up immediately if it succeeds)
  let createAttempt: unknown = "skipped (ctId already exists or no identifier)";
  if (!ctId && (fnGid || fnHandle)) {
    const createData = await shopifyGraphql(
      shop,
      session.accessToken,
      fnGid
        ? `
          mutation TryCreate($fnId: String!) {
            cartTransformCreate(functionId: $fnId) {
              cartTransform { id functionId }
              userErrors { field message code }
            }
          }
        `
        : `
          mutation TryCreate($fnHandle: String!) {
            cartTransformCreate(functionHandle: $fnHandle) {
              cartTransform { id functionId }
              userErrors { field message code }
            }
          }
        `,
      fnGid ? { fnId: fnGid } : { fnHandle },
    );
    const created = createData?.data?.cartTransformCreate?.cartTransform;
    const userErrors = createData?.data?.cartTransformCreate?.userErrors ?? [];
    createAttempt = {
      result: created ? "created" : "failed",
      cartTransform: created ?? null,
      userErrors,
      topErrors: createData?.errors ?? null,
      using: fnGid ? { functionId: fnGid } : { functionHandle: fnHandle },
    };
    if (created?.id) {
      await shopifyGraphql(
        shop,
        session.accessToken,
        `
          mutation Del($id: ID!) { cartTransformDelete(id: $id) { deletedId } }
        `,
        { id: created.id },
      );
    }
  } else if (ctId) {
    createAttempt = "skipped (ctId already exists: " + ctId + ")";
  }

  return NextResponse.json({
    shop,
    cachedCtId,
    fnHandle,
    fnGid,
    deprecatedUid,
    transforms,
    createAttempt,
    metafieldValue,
    metafieldParsed,
    metafieldParseError,
    firebaseRules,
    env: {
      SHOPIFY_GIFT_FUNCTION_HANDLE: process.env.SHOPIFY_GIFT_FUNCTION_HANDLE ?? null,
      SHOPIFY_GIFT_FUNCTION_ID: process.env.SHOPIFY_GIFT_FUNCTION_ID ?? null,
      SHOPIFY_GIFT_FUNCTION_UUID: process.env.SHOPIFY_GIFT_FUNCTION_UUID ?? null,
    },
  });
}

