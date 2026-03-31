import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { getGiftRules } from "@/lib/firebase/giftRuleStore";
import { getShopGiftRulesMetafield } from "@/lib/shopify/shopGiftRulesMetafield";
import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE = "$app:gwp_rule";

async function getSession(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const shop = cookie ? await verifyShop(cookie) : null;
  if (!shop) return null;
  const session = await firestoreSessionStorage.loadSession(`offline_${shop}`);
  if (!session?.accessToken) return null;
  return session;
}

function parseJsonSafely(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawMetaobjects = await shopifyAdminGraphql(
    session.shop,
    session.accessToken!,
    `
      query DebugGiftMetaobjects($type: String!) {
        metaobjects(type: $type, first: 50) {
          nodes {
            id
            handle
            displayName
            updatedAt
            fields {
              key
              value
            }
          }
        }
      }
    `,
    { type: TYPE },
  );

  const shopMeta = await shopifyAdminGraphql(
    session.shop,
    session.accessToken!,
    `
      query DebugGiftShopMetafield {
        shop {
          id
          giftRules: metafield(namespace: "gwp", key: "gift_rules") {
            id
            value
          }
        }
      }
    `,
  );

  const firebaseRules = await getGiftRules(session.shop);
  const shopMetafieldRules = await getShopGiftRulesMetafield(session.shop, session.accessToken!).catch((e) => ({
    error: e instanceof Error ? e.message : String(e),
  }));

  return NextResponse.json({
    shop: session.shop,
    requestedType: TYPE,
    metaobjects: rawMetaobjects?.data?.metaobjects?.nodes ?? [],
    metaobjectTopErrors: rawMetaobjects?.errors ?? null,
    shopMetafield: {
      raw: shopMeta?.data?.shop?.giftRules?.value ?? null,
      parsed: parseJsonSafely(shopMeta?.data?.shop?.giftRules?.value ?? null),
      id: shopMeta?.data?.shop?.giftRules?.id ?? null,
      topErrors: shopMeta?.errors ?? null,
    },
    shopMetafieldRules,
    firebaseRules,
  });
}
