import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";
import { resolveMetaobjectType } from "@/lib/shopify/metaobjectType";

export interface PostPurchaseProduct {
  productId: string;
  variantId: string;
  title: string;
  image: string;
  price: string;
  handle: string;
}

export interface PostPurchaseOffer {
  id: string;
  name: string;
  offerProduct: PostPurchaseProduct | null;
  headline: string;
  body: string;
  ctaLabel: string;
  discountPercent: number;
  priority: number;
  triggerType: "all_orders" | "minimum_subtotal" | "contains_product";
  triggerProductIds: string[];
  minimumSubtotal: number;
  enabled: boolean;
}

const TYPE = "$app:post_purchase_offer";
const DEFINITION_NAME = "Post Purchase Offer";

function normalizePositiveInt(value: unknown, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePositiveNumber(value: unknown, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? fallback));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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

async function ensurePostPurchaseDefinition(shop: string, accessToken: string) {
  const resolved = await resolveMetaobjectType(shop, accessToken, TYPE, DEFINITION_NAME);
  if (resolved.foundDefinition) {
    return resolved.type;
  }

  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation CreatePostPurchaseDefinition($definition: MetaobjectDefinitionCreateInput!) {
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
          { name: "Offer name", key: "name", type: "single_line_text_field" },
          { name: "Offer product", key: "offer_product", type: "multi_line_text_field" },
          { name: "Headline", key: "headline", type: "single_line_text_field" },
          { name: "Body", key: "body", type: "multi_line_text_field" },
          { name: "CTA label", key: "cta_label", type: "single_line_text_field" },
          { name: "Discount percent", key: "discount_percent", type: "number_integer" },
          { name: "Priority", key: "priority", type: "number_integer" },
          { name: "Trigger type", key: "trigger_type", type: "single_line_text_field" },
          { name: "Trigger product ids", key: "trigger_product_ids", type: "multi_line_text_field" },
          { name: "Minimum subtotal", key: "minimum_subtotal", type: "number_decimal" },
        ],
      },
    },
  );

  const errors = response?.data?.metaobjectDefinitionCreate?.userErrors ?? [];
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    const message = String(first?.message ?? "");
    if (!/already exists/i.test(message)) {
      throw new Error(message || "Failed to create post-purchase definition");
    }
  }

  return TYPE;
}

function mapOffer(handle: string, fields: Array<{ key: string; value: string }>): PostPurchaseOffer {
  const triggerType = String(getFieldValue(fields, "trigger_type") ?? "all_orders");
  const parsedTriggerType = triggerType === "minimum_subtotal" || triggerType === "contains_product"
    ? triggerType
    : "all_orders";
  const offerProduct = parseJson<PostPurchaseProduct | null>(getFieldValue(fields, "offer_product"), null);

  return {
    id: handle,
    name: String(getFieldValue(fields, "name") ?? "").trim() || "Post-purchase offer",
    offerProduct: offerProduct?.productId && offerProduct?.variantId ? offerProduct : null,
    headline: String(getFieldValue(fields, "headline") ?? "").trim(),
    body: String(getFieldValue(fields, "body") ?? "").trim(),
    ctaLabel: String(getFieldValue(fields, "cta_label") ?? "").trim() || "Add to order",
    discountPercent: normalizePositiveInt(getFieldValue(fields, "discount_percent"), 10),
    priority: normalizePositiveInt(getFieldValue(fields, "priority"), 1),
    triggerType: parsedTriggerType,
    triggerProductIds: parseJson<string[]>(getFieldValue(fields, "trigger_product_ids"), []).filter(Boolean),
    minimumSubtotal: normalizePositiveNumber(getFieldValue(fields, "minimum_subtotal"), 0),
    enabled: String(getFieldValue(fields, "enabled") ?? "true") !== "false",
  };
}

export async function listPostPurchaseOffers(shop: string, accessToken: string): Promise<PostPurchaseOffer[]> {
  const type = await ensurePostPurchaseDefinition(shop, accessToken);
  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query PostPurchaseOffers($type: String!) {
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
      mapOffer(String(node.handle), node.fields ?? []),
    )
    .filter((offer: PostPurchaseOffer) => offer.enabled && offer.offerProduct?.variantId)
    .sort((a: PostPurchaseOffer, b: PostPurchaseOffer) => a.priority - b.priority || a.name.localeCompare(b.name));
}

export async function upsertPostPurchaseOffer(
  shop: string,
  accessToken: string,
  offer: Omit<PostPurchaseOffer, "id"> & { id?: string },
) {
  const type = await ensurePostPurchaseDefinition(shop, accessToken);
  const handle = offer.id?.trim() ? offer.id.trim() : `post-purchase-${Date.now()}`;
  if (!offer.offerProduct?.variantId) throw new Error("Select an offer product");
  if (!offer.name?.trim()) throw new Error("Enter an offer name");

  const fields = [
    { key: "enabled", value: offer.enabled === false ? "false" : "true" },
    { key: "name", value: offer.name.trim() || "Post-purchase offer" },
    { key: "offer_product", value: JSON.stringify(offer.offerProduct) },
    { key: "headline", value: offer.headline?.trim() || "" },
    { key: "body", value: offer.body?.trim() || "" },
    { key: "cta_label", value: offer.ctaLabel?.trim() || "Add to order" },
    { key: "discount_percent", value: String(normalizePositiveInt(offer.discountPercent, 10)) },
    { key: "priority", value: String(normalizePositiveInt(offer.priority, 1)) },
    { key: "trigger_type", value: offer.triggerType || "all_orders" },
    { key: "trigger_product_ids", value: JSON.stringify((offer.triggerProductIds ?? []).filter(Boolean)) },
    { key: "minimum_subtotal", value: String(normalizePositiveNumber(offer.minimumSubtotal, 0)) },
  ];

  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation UpsertPostPurchaseOffer($type: String!, $handle: String!, $fields: [MetaobjectFieldInput!]!) {
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
    throw new Error(errors[0]?.message ?? "Failed to save post-purchase offer");
  }

  return { id: response?.data?.metaobjectUpsert?.metaobject?.handle ?? handle };
}

export async function deletePostPurchaseOffer(shop: string, accessToken: string, handle: string) {
  const type = await ensurePostPurchaseDefinition(shop, accessToken);
  const lookup = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query PostPurchaseOfferId($type: String!, $handle: String!) {
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
      mutation DeletePostPurchaseOffer($id: ID!) {
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
    throw new Error(errors[0]?.message ?? "Failed to delete post-purchase offer");
  }
}
