import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";
import { resolveMetaobjectType } from "@/lib/shopify/metaobjectType";

export interface BxgyProduct {
  productId: string;
  variantId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
}

export interface BxgyRule {
  id: string;
  name: string;
  buyProducts: BxgyProduct[];
  giftProduct: BxgyProduct | null;
  buyQuantity: number;
  giftQuantity: number;
  message: string;
  autoAdd: boolean;
  priority: number;
  enabled: boolean;
}

const TYPE = "$app:bxgy_rule";
const DEFINITION_NAME = "Buy X Get Y Rule";

function normalizePositiveInt(value: unknown, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getFieldValue(fields: Array<{ key: string; value: string }> | null | undefined, key: string) {
  if (!fields) return null;
  const field = fields.find((entry) => entry?.key === key);
  return field?.value ?? null;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function ensureBxgyDefinition(shop: string, accessToken: string) {
  const resolved = await resolveMetaobjectType(shop, accessToken, TYPE, DEFINITION_NAME);
  if (resolved.foundDefinition) {
    return resolved.type;
  }

  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation CreateBxgyDefinition($definition: MetaobjectDefinitionCreateInput!) {
        metaobjectDefinitionCreate(definition: $definition) {
          metaobjectDefinition {
            type
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `,
    {
      definition: {
        name: DEFINITION_NAME,
        type: TYPE,
        access: {
          admin: "MERCHANT_READ_WRITE",
          storefront: "PUBLIC_READ",
        },
        fieldDefinitions: [
          { name: "Enabled", key: "enabled", type: "boolean" },
          { name: "Rule name", key: "name", type: "single_line_text_field" },
          { name: "Buy products", key: "buy_products", type: "multi_line_text_field" },
          { name: "Gift product", key: "gift_product", type: "multi_line_text_field" },
          { name: "Buy quantity", key: "buy_quantity", type: "number_integer" },
          { name: "Gift quantity", key: "gift_quantity", type: "number_integer" },
          { name: "Message", key: "message", type: "multi_line_text_field" },
          { name: "Auto add", key: "auto_add", type: "boolean" },
          { name: "Priority", key: "priority", type: "number_integer" },
        ],
      },
    },
  );

  const errors = response?.data?.metaobjectDefinitionCreate?.userErrors ?? [];
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    const message = String(first?.message ?? "");
    if (!/already exists/i.test(message)) {
      throw new Error(message || "Failed to create BXGY definition");
    }
  }

  return TYPE;
}

function mapRule(handle: string, fields: Array<{ key: string; value: string }>): BxgyRule {
  const buyProducts = parseJson<BxgyProduct[]>(getFieldValue(fields, "buy_products"), []).filter(
    (product) => Boolean(product?.productId) && Boolean(product?.variantId),
  );
  const giftProduct = parseJson<BxgyProduct | null>(getFieldValue(fields, "gift_product"), null);

  return {
    id: handle,
    name: String(getFieldValue(fields, "name") ?? "").trim() || "Buy X Get Y",
    buyProducts,
    giftProduct: giftProduct?.productId && giftProduct?.variantId ? giftProduct : null,
    buyQuantity: normalizePositiveInt(getFieldValue(fields, "buy_quantity"), 1),
    giftQuantity: normalizePositiveInt(getFieldValue(fields, "gift_quantity"), 1),
    message: String(getFieldValue(fields, "message") ?? "").trim(),
    autoAdd: String(getFieldValue(fields, "auto_add") ?? "true") !== "false",
    priority: normalizePositiveInt(getFieldValue(fields, "priority"), 1),
    enabled: String(getFieldValue(fields, "enabled") ?? "true") !== "false",
  };
}

export async function listBxgyRules(shop: string, accessToken: string): Promise<BxgyRule[]> {
  const type = await ensureBxgyDefinition(shop, accessToken);
  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query BxgyRules($type: String!) {
        metaobjects(type: $type, first: 250) {
          nodes {
            handle
            fields {
              key
              value
            }
          }
        }
      }
    `,
    { type },
  );

  const nodes = response?.data?.metaobjects?.nodes ?? [];
  return nodes
    .map((node: { handle: string; fields: Array<{ key: string; value: string }> }) =>
      mapRule(String(node.handle), node.fields ?? []),
    )
    .filter((rule: BxgyRule) => rule.enabled && rule.buyProducts.length > 0 && rule.giftProduct?.variantId)
    .sort((a: BxgyRule, b: BxgyRule) => a.priority - b.priority || a.name.localeCompare(b.name));
}

export async function upsertBxgyRule(
  shop: string,
  accessToken: string,
  rule: Omit<BxgyRule, "id"> & { id?: string },
) {
  const type = await ensureBxgyDefinition(shop, accessToken);
  const handle = rule.id?.trim() ? rule.id.trim() : `bxgy-${Date.now()}`;
  if (!rule.buyProducts.length) throw new Error("Select at least one Buy product");
  if (!rule.giftProduct?.variantId) throw new Error("Select a Gift product");

  const fields = [
    { key: "enabled", value: rule.enabled === false ? "false" : "true" },
    { key: "name", value: rule.name?.trim() || "Buy X Get Y" },
    { key: "buy_products", value: JSON.stringify(rule.buyProducts) },
    { key: "gift_product", value: JSON.stringify(rule.giftProduct) },
    { key: "buy_quantity", value: String(normalizePositiveInt(rule.buyQuantity, 1)) },
    { key: "gift_quantity", value: String(normalizePositiveInt(rule.giftQuantity, 1)) },
    { key: "message", value: rule.message?.trim() || "" },
    { key: "auto_add", value: rule.autoAdd === false ? "false" : "true" },
    { key: "priority", value: String(normalizePositiveInt(rule.priority, 1)) },
  ];

  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation UpsertBxgyRule($type: String!, $handle: String!, $fields: [MetaobjectFieldInput!]!) {
        metaobjectUpsert(
          handle: { type: $type, handle: $handle }
          metaobject: { fields: $fields }
        ) {
          metaobject {
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    { type, handle, fields },
  );

  const errors = response?.data?.metaobjectUpsert?.userErrors ?? [];
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Failed to save BXGY rule");
  }

  return { id: response?.data?.metaobjectUpsert?.metaobject?.handle ?? handle };
}

export async function deleteBxgyRule(shop: string, accessToken: string, handle: string) {
  const type = await ensureBxgyDefinition(shop, accessToken);
  const lookup = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query BxgyRuleId($type: String!, $handle: String!) {
        metaobjectByHandle(handle: { type: $type, handle: $handle }) {
          id
        }
      }
    `,
    { type, handle },
  );

  const id = lookup?.data?.metaobjectByHandle?.id as string | undefined;
  if (!id) return;

  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation DeleteBxgyRule($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors {
            field
            message
          }
        }
      }
    `,
    { id },
  );

  const errors = response?.data?.metaobjectDelete?.userErrors ?? [];
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Failed to delete BXGY rule");
  }
}
