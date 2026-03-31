import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";
import { resolveUpsellRuleType } from "@/lib/shopify/ensureMetaobjectDefinitions";

export interface UpsellProduct {
  productId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
  discountPercent: number;
}

export interface UpsellRule {
  id: string; // metaobject handle
  triggerProductId: string;
  triggerProductTitle: string;
  upsellProducts: UpsellProduct[];
  message: string;
}

// Prefer canonical app-owned types (app--<appId>--upsell_rule). `$app:*` is only used in config files, not runtime API calls.

function throwIfGraphqlErrors(res: any) {
  const errors = res?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return;
  throw new Error(errors.map((e: any) => e?.message).filter(Boolean).join("; ") || "Shopify GraphQL error");
}

function productGidFromId(productId: string) {
  const id = String(productId || "").trim();
  if (!id) return null;
  if (id.startsWith("gid://shopify/Product/")) return id;
  return `gid://shopify/Product/${id.replace(/^gid:\/\/shopify\/Product\//, "")}`;
}

function productIdFromGid(gid: string | null | undefined) {
  if (!gid) return null;
  const m = String(gid).match(/gid:\/\/shopify\/Product\/(\d+)/);
  return m ? m[1] : null;
}

function getFieldValue(fields: Array<{ key: string; value: string }> | null | undefined, key: string) {
  if (!fields) return null;
  const f = fields.find((x) => x && x.key === key);
  return f ? f.value : null;
}

function parseUpsellProducts(raw: string | null) {
  if (!raw) return [] as UpsellProduct[];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UpsellProduct[]) : [];
  } catch {
    return [] as UpsellProduct[];
  }
}

export async function listUpsellRules(shop: string, accessToken: string): Promise<UpsellRule[]> {
  const type = await resolveUpsellRuleType({ shop, accessToken });
  const data = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query UpsellRules($type: String!) {
        metaobjects(type: $type, first: 250) {
          nodes {
            id
            handle
            fields { key value }
          }
        }
      }
    `,
    { type },
  );
  throwIfGraphqlErrors(data);

  const nodes = data?.data?.metaobjects?.nodes ?? [];
  const rules: UpsellRule[] = [];
  for (const n of nodes) {
    const enabled = String(getFieldValue(n.fields, "enabled") ?? "true") === "true";
    if (!enabled) continue;

    const triggerProductId = productIdFromGid(getFieldValue(n.fields, "trigger_product"));
    if (!triggerProductId) continue;

    rules.push({
      id: String(n.handle),
      triggerProductId,
      triggerProductTitle: String(getFieldValue(n.fields, "trigger_product_title") ?? ""),
      message: String(getFieldValue(n.fields, "message") ?? ""),
      upsellProducts: parseUpsellProducts(getFieldValue(n.fields, "upsell_products")),
    });
  }
  return rules;
}

export async function getUpsellRule(shop: string, accessToken: string, handle: string): Promise<UpsellRule | null> {
  const h = String(handle || "").trim();
  if (!h) return null;
  const type = await resolveUpsellRuleType({ shop, accessToken });

  const data = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query UpsellRuleByHandle($type: String!, $handle: String!) {
        metaobjectByHandle(handle: { type: $type, handle: $handle }) {
          id
          handle
          fields { key value }
        }
      }
    `,
    { type, handle: h },
  );
  throwIfGraphqlErrors(data);

  const mo = data?.data?.metaobjectByHandle;
  if (!mo?.handle) return null;

  const enabled = String(getFieldValue(mo.fields, "enabled") ?? "true") === "true";
  if (!enabled) return null;

  const triggerProductId = productIdFromGid(getFieldValue(mo.fields, "trigger_product"));
  if (!triggerProductId) return null;

  return {
    id: String(mo.handle),
    triggerProductId,
    triggerProductTitle: String(getFieldValue(mo.fields, "trigger_product_title") ?? ""),
    message: String(getFieldValue(mo.fields, "message") ?? ""),
    upsellProducts: parseUpsellProducts(getFieldValue(mo.fields, "upsell_products")),
  };
}

export async function upsertUpsellRule(
  shop: string,
  accessToken: string,
  rule: Omit<UpsellRule, "id"> & { id?: string },
) {
  const type = await resolveUpsellRuleType({ shop, accessToken });
  const handle = rule.id && String(rule.id).trim() ? String(rule.id).trim() : `upsell-${Date.now()}`;
  const triggerGid = productGidFromId(rule.triggerProductId);
  if (!triggerGid) throw new Error("Missing trigger product id");

  const fields = [
    { key: "enabled", value: "true" },
    { key: "trigger_product", value: triggerGid },
    { key: "trigger_product_title", value: rule.triggerProductTitle || "" },
    { key: "message", value: rule.message || "" },
    { key: "upsell_products", value: JSON.stringify(rule.upsellProducts ?? []) },
  ];

  const res = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation UpsertUpsellRule($type: String!, $handle: String!, $fields: [MetaobjectFieldInput!]!) {
        metaobjectUpsert(
          handle: { type: $type, handle: $handle }
          metaobject: { fields: $fields }
        ) {
          metaobject { id handle }
          userErrors { field message }
        }
      }
    `,
    { type, handle, fields },
  );
  throwIfGraphqlErrors(res);

  const userErrors = res?.data?.metaobjectUpsert?.userErrors ?? [];
  if (Array.isArray(userErrors) && userErrors.length > 0) {
    throw new Error(userErrors[0]?.message ?? "Failed to save upsell rule");
  }

  return { id: res?.data?.metaobjectUpsert?.metaobject?.handle ?? handle };
}

export async function deleteUpsellRule(shop: string, accessToken: string, handle: string) {
  const type = await resolveUpsellRuleType({ shop, accessToken });
  const data = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query UpsellRuleId($type: String!, $handle: String!) {
        metaobjectByHandle(handle: { type: $type, handle: $handle }) { id }
      }
    `,
    { type, handle },
  );

  const id = data?.data?.metaobjectByHandle?.id as string | undefined;
  if (!id) return;

  const res = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation DeleteUpsellRule($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors { field message }
        }
      }
    `,
    { id },
  );

  const userErrors = res?.data?.metaobjectDelete?.userErrors ?? [];
  if (Array.isArray(userErrors) && userErrors.length > 0) {
    throw new Error(userErrors[0]?.message ?? "Failed to delete upsell rule");
  }
}
