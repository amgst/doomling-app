import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";
import { resolveMetaobjectType } from "@/lib/shopify/metaobjectType";

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

const TYPE = "$app:upsell_rule";
const DEFINITION_NAME = "Upsell rule";

async function getUpsellType(shop: string, accessToken: string) {
  const resolved = await resolveMetaobjectType(shop, accessToken, TYPE, DEFINITION_NAME);
  return resolved.type;
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

type ProductSnapshot = {
  id: string;
  title: string;
  handle: string;
  image: string;
  price: string;
};

async function loadProductSnapshots(shop: string, accessToken: string, productIds: string[]) {
  const uniqueIds = Array.from(new Set(productIds.map((id) => String(id || "").trim()).filter(Boolean)));
  if (!uniqueIds.length) return new Map<string, ProductSnapshot>();

  const gids = uniqueIds
    .map((id) => productGidFromId(id))
    .filter((gid): gid is string => Boolean(gid));

  if (!gids.length) return new Map<string, ProductSnapshot>();

  const data = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query UpsellRuleProducts($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            handle
            featuredImage {
              url
            }
            variants(first: 1) {
              nodes {
                price
              }
            }
          }
        }
      }
    `,
    { ids: gids },
  );

  const snapshots = new Map<string, ProductSnapshot>();
  const nodes = data?.data?.nodes ?? [];
  for (const node of nodes) {
    const productId = productIdFromGid(node?.id);
    if (!productId) continue;
    snapshots.set(productId, {
      id: productId,
      title: String(node?.title ?? ""),
      handle: String(node?.handle ?? ""),
      image: String(node?.featuredImage?.url ?? ""),
      price: String(node?.variants?.nodes?.[0]?.price ?? ""),
    });
  }

  return snapshots;
}

async function hydrateUpsellRule(shop: string, accessToken: string, rule: UpsellRule) {
  const ids = [rule.triggerProductId, ...rule.upsellProducts.map((product) => product.productId)];
  const snapshots = await loadProductSnapshots(shop, accessToken, ids);

  const triggerSnapshot = snapshots.get(rule.triggerProductId);
  const upsellProducts = rule.upsellProducts.map((product) => {
    const snapshot = snapshots.get(product.productId);
    return {
      ...product,
      title: product.title || snapshot?.title || "",
      image: product.image || snapshot?.image || "",
      price: product.price || snapshot?.price || "",
      handle: product.handle || snapshot?.handle || "",
    };
  });

  return {
    ...rule,
    triggerProductTitle: rule.triggerProductTitle || triggerSnapshot?.title || "",
    upsellProducts,
  };
}

export async function listUpsellRules(shop: string, accessToken: string): Promise<UpsellRule[]> {
  const type = await getUpsellType(shop, accessToken);
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
  return Promise.all(rules.map((rule) => hydrateUpsellRule(shop, accessToken, rule)));
}

export async function getUpsellRule(shop: string, accessToken: string, handle: string): Promise<UpsellRule | null> {
  const h = String(handle || "").trim();
  if (!h) return null;
  const type = await getUpsellType(shop, accessToken);

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

  const mo = data?.data?.metaobjectByHandle;
  if (!mo?.handle) return null;

  const enabled = String(getFieldValue(mo.fields, "enabled") ?? "true") === "true";
  if (!enabled) return null;

  const triggerProductId = productIdFromGid(getFieldValue(mo.fields, "trigger_product"));
  if (!triggerProductId) return null;

  return hydrateUpsellRule(shop, accessToken, {
    id: String(mo.handle),
    triggerProductId,
    triggerProductTitle: String(getFieldValue(mo.fields, "trigger_product_title") ?? ""),
    message: String(getFieldValue(mo.fields, "message") ?? ""),
    upsellProducts: parseUpsellProducts(getFieldValue(mo.fields, "upsell_products")),
  });
}

export async function upsertUpsellRule(
  shop: string,
  accessToken: string,
  rule: Omit<UpsellRule, "id"> & { id?: string },
) {
  const type = await getUpsellType(shop, accessToken);
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

  const userErrors = res?.data?.metaobjectUpsert?.userErrors ?? [];
  if (Array.isArray(userErrors) && userErrors.length > 0) {
    throw new Error(userErrors[0]?.message ?? "Failed to save upsell rule");
  }

  return { id: res?.data?.metaobjectUpsert?.metaobject?.handle ?? handle };
}

export async function deleteUpsellRule(shop: string, accessToken: string, handle: string) {
  const type = await getUpsellType(shop, accessToken);
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

