import { NextRequest, NextResponse } from "next/server";
import { verifyShop, COOKIE_NAME } from "@/lib/utils/standaloneSession";
import { firestoreSessionStorage } from "@/lib/firebase/sessionStore";
import { getGiftRulesFromMetaobjects } from "@/lib/shopify/gwpRuleStore";
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

function variantGidFromId(variantId: string) {
  const id = String(variantId || "").trim();
  if (!id) return null;
  if (id.startsWith("gid://shopify/ProductVariant/")) return id;
  return `gid://shopify/ProductVariant/${id.replace(/^gid:\/\/shopify\/ProductVariant\//, "")}`;
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await getGiftRulesFromMetaobjects(session.shop, session.accessToken!).catch(() => []);
  const rule = Array.isArray(rules) && rules.length > 0 ? rules[0] : null;

  if (!rule?.mainVariantId || !rule?.giftVariantId) {
    return NextResponse.json({ error: "No readable gift metaobject rule found to test upsert against." }, { status: 400 });
  }

  const handle = `main-${rule.mainVariantId}`;
  const fields = [
    { key: "enabled", value: "true" },
    { key: "title", value: `Main ${rule.mainVariantId} -> Gift ${rule.giftVariantId}` },
    { key: "main_variant", value: variantGidFromId(rule.mainVariantId) },
    { key: "gift_variant", value: variantGidFromId(rule.giftVariantId) },
    { key: "gift_quantity_mode", value: "match_main_qty" },
    { key: "min_main_qty", value: "1" },
  ];

  const raw = await shopifyAdminGraphql(
    session.shop,
    session.accessToken!,
    `
      mutation DebugUpsertGiftRule($type: String!, $handle: String!, $fields: [MetaobjectFieldInput!]!) {
        metaobjectUpsert(
          handle: { type: $type, handle: $handle }
          metaobject: { fields: $fields }
        ) {
          metaobject { id handle }
          userErrors { field message code }
        }
      }
    `,
    { type: TYPE, handle, fields },
  );

  return NextResponse.json({
    shop: session.shop,
    type: TYPE,
    handle,
    rule,
    fields,
    raw,
  });
}
