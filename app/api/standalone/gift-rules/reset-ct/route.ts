import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { setCartTransformId } from "@/lib/firebase/giftRuleStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// POST /api/standalone/gift-rules/reset-ct
// Deletes all CartTransforms on the store and clears the cached ID in Firebase
export async function POST(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  if (!session?.accessToken) return NextResponse.json({ error: "No access token" }, { status: 403 });

  // Find all CartTransforms
  const ctData = await shopifyGraphql(shop, session.accessToken, `
    query { cartTransforms(first: 10) { nodes { id } } }
  `);
  const transforms: { id: string }[] = ctData?.data?.cartTransforms?.nodes ?? [];

  const results = [];
  for (const ct of transforms) {
    const del = await shopifyGraphql(shop, session.accessToken, `
      mutation DeleteCT($id: ID!) {
        cartTransformDelete(id: $id) {
          deletedId
          userErrors { field message }
        }
      }
    `, { id: ct.id });
    results.push({ id: ct.id, result: del?.data?.cartTransformDelete });
  }

  // Clear cached ID in Firebase
  await setCartTransformId(shop, "");

  return NextResponse.json({ deleted: results, transforms });
}
