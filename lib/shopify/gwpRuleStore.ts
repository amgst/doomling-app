import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";

export type GiftRule = {
  mainVariantId: string;
  giftVariantId: string;
};

function variantGidFromId(variantId: string) {
  const id = String(variantId || "").trim();
  if (!id) return null;
  if (id.startsWith("gid://shopify/ProductVariant/")) return id;
  return `gid://shopify/ProductVariant/${id.replace(/^gid:\/\/shopify\/ProductVariant\//, "")}`;
}

function variantIdFromGid(gid: string | null | undefined) {
  if (!gid) return null;
  const m = String(gid).match(/gid:\/\/shopify\/ProductVariant\/(\d+)/);
  return m ? m[1] : null;
}

function getFieldValue(fields: Array<{ key: string; value: string }> | null | undefined, key: string) {
  if (!fields) return null;
  const f = fields.find((x) => x && x.key === key);
  return f ? f.value : null;
}

const TYPE = "$app:gwp_rule";

export async function getGiftRulesFromMetaobjects(shop: string, accessToken: string): Promise<GiftRule[]> {
  const data = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query GwpRules($type: String!) {
        metaobjects(type: $type, first: 250) {
          nodes {
            id
            handle
            fields { key value }
          }
        }
      }
    `,
    { type: TYPE },
  );

  const nodes = data?.data?.metaobjects?.nodes ?? [];
  const rules: GiftRule[] = [];

  for (const n of nodes) {
    const enabled = String(getFieldValue(n.fields, "enabled") ?? "true") === "true";
    if (!enabled) continue;

    const mainVariantId = variantIdFromGid(getFieldValue(n.fields, "main_variant"));
    const giftVariantId = variantIdFromGid(getFieldValue(n.fields, "gift_variant"));
    if (!mainVariantId || !giftVariantId) continue;

    rules.push({ mainVariantId, giftVariantId });
  }

  return rules;
}

export async function setGiftRulesToMetaobjects(shop: string, accessToken: string, rules: GiftRule[]) {
  const desired = (Array.isArray(rules) ? rules : [])
    .filter((r) => r && r.mainVariantId && r.giftVariantId)
    .map((r) => ({ mainVariantId: String(r.mainVariantId), giftVariantId: String(r.giftVariantId) }));

  const desiredHandles = new Set(desired.map((r) => `main-${r.mainVariantId}`));

  const upsert = async (handle: string, fields: Array<{ key: string; value: string }>) => {
    const res = await shopifyAdminGraphql(
      shop,
      accessToken,
      `
        mutation UpsertGwpRule($type: String!, $handle: String!, $fields: [MetaobjectFieldInput!]!) {
          metaobjectUpsert(
            handle: { type: $type, handle: $handle }
            metaobject: { fields: $fields }
          ) {
            metaobject { id handle }
            userErrors { field message }
          }
        }
      `,
      { type: TYPE, handle, fields },
    );

    const userErrors = res?.data?.metaobjectUpsert?.userErrors ?? [];
    if (Array.isArray(userErrors) && userErrors.length > 0) {
      throw new Error(`Metaobject upsert failed: ${userErrors.map((e: any) => e.message).join("; ")}`);
    }
  };

  // Upsert desired rules
  for (const r of desired) {
    const handle = `main-${r.mainVariantId}`;
    const mainGid = variantGidFromId(r.mainVariantId);
    const giftGid = variantGidFromId(r.giftVariantId);
    if (!mainGid || !giftGid) continue;

    await upsert(handle, [
      { key: "enabled", value: "true" },
      { key: "title", value: `Main ${r.mainVariantId} → Gift ${r.giftVariantId}` },
      { key: "main_variant", value: mainGid },
      { key: "gift_variant", value: giftGid },
      { key: "gift_quantity_mode", value: "match_main_qty" },
      { key: "min_main_qty", value: "1" },
    ]);
  }

  // Best-effort: disable any existing rules not in the current set
  try {
    const current = await shopifyAdminGraphql(
      shop,
      accessToken,
      `
        query CurrentGwpRuleHandles($type: String!) {
          metaobjects(type: $type, first: 250) {
            nodes { handle }
          }
        }
      `,
      { type: TYPE },
    );
    const nodes = current?.data?.metaobjects?.nodes ?? [];
    const toDisable = nodes
      .map((n: any) => String(n?.handle || ""))
      .filter((h: string) => h && !desiredHandles.has(h));

    for (const handle of toDisable) {
      await upsert(handle, [{ key: "enabled", value: "false" }]);
    }
  } catch {
    // ignore
  }
}
