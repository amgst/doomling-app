import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";
import type { BxgyRule } from "@/lib/shopify/bxgyRuleStore";
import { getShop, updateShopSettings } from "@/lib/firebase/shopStore";

const TITLE = "Upsale Buy X Get Y";
const NS = "upsale";
const KEY = "config";

type DiscountRecord = {
  id: string;
  title: string;
  functionId: string;
};

function variantGidFromId(variantId: string) {
  const value = String(variantId || "").trim();
  if (!value) return null;
  if (value.startsWith("gid://shopify/ProductVariant/")) return value;
  return `gid://shopify/ProductVariant/${value.replace(/^gid:\/\/shopify\/ProductVariant\//, "")}`;
}

function buildConfig(rules: BxgyRule[]) {
  return {
    version: 1,
    bxgyRules: rules
      .filter((rule) => rule.enabled && rule.giftProduct?.variantId && rule.buyProducts.length > 0)
      .map((rule) => ({
        ruleId: rule.id,
        buyVariantIds: rule.buyProducts
          .map((product) => variantGidFromId(product.variantId))
          .filter(Boolean),
        giftVariantId: variantGidFromId(rule.giftProduct?.variantId ?? ""),
        buyQuantity: rule.buyQuantity,
        giftQuantity: rule.giftQuantity,
      }))
      .filter((rule) => rule.buyVariantIds.length > 0 && rule.giftVariantId),
  };
}

let cachedFunctionIdByShop = new Map<string, string>();

async function resolveFunctionId(shop: string, accessToken: string): Promise<string> {
  const cached = cachedFunctionIdByShop.get(shop);
  if (cached) return cached;

  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query AppDiscountTypes {
        appDiscountTypes {
          appKey
          functionId
          title
          discountClasses
        }
      }
    `,
  );

  const appKey = process.env.SHOPIFY_API_KEY?.trim();
  const types = Array.isArray(response?.data?.appDiscountTypes) ? response.data.appDiscountTypes : [];
  const appTypes = appKey ? types.filter((entry: any) => entry?.appKey === appKey) : types;

  const preferred =
    appTypes.find((entry: any) => typeof entry?.title === "string" && /upsale/i.test(entry.title)) ??
    appTypes[0] ??
    null;

  const functionId =
    typeof preferred?.functionId === "string" && preferred.functionId.trim() ? preferred.functionId.trim() : null;

  if (!functionId) {
    throw new Error(
      "Could not find the released Shopify Function ID from Shopify Admin. Make sure the current app version with the discount function is installed on this store.",
    );
  }

  cachedFunctionIdByShop.set(shop, functionId);
  return functionId;
}

async function findExistingDiscount(shop: string, accessToken: string): Promise<DiscountRecord | null> {
  const functionId = await resolveFunctionId(shop, accessToken);
  const stored = await getShop(shop);
  const storedId = stored?.settings?.bxgyDiscountId;

  if (typeof storedId === "string" && storedId) {
    return {
      id: storedId,
      title: TITLE,
      functionId,
    };
  }

  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query ExistingAutomaticAppDiscounts {
        automaticDiscountNodes(first: 50, query: "type:app") {
          nodes {
            id
            automaticDiscount {
              ... on DiscountAutomaticApp {
                title
                appDiscountType {
                  functionId
                }
              }
            }
          }
        }
      }
    `,
  );

  const nodes = response?.data?.automaticDiscountNodes?.nodes ?? [];
  const match = nodes.find((node: any) => {
    const discount = node?.automaticDiscount;
    return discount?.appDiscountType?.functionId === functionId;
  });

  if (!match?.id) return null;

  const record = {
    id: String(match.id),
    title: String(match?.automaticDiscount?.title ?? TITLE),
    functionId,
  };

  await updateShopSettings(shop, {
    ...(stored?.settings ?? {}),
    bxgyDiscountId: record.id,
  });

  return record;
}

export async function syncBxgyDiscount(shop: string, accessToken: string, rules: BxgyRule[]) {
  const functionId = await resolveFunctionId(shop, accessToken);
  const config = buildConfig(rules);
  const metafields = [
    {
      namespace: NS,
      key: KEY,
      type: "json",
      value: JSON.stringify(config),
    },
  ];

  const existing = await findExistingDiscount(shop, accessToken);
  const startsAt = new Date().toISOString();

  if (!existing) {
    const createResponse = await shopifyAdminGraphql(
      shop,
      accessToken,
      `
        mutation CreateAutomaticBxgyDiscount($automaticAppDiscount: DiscountAutomaticAppInput!) {
          discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
            automaticAppDiscount {
              discountId
              title
              appDiscountType {
                functionId
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        automaticAppDiscount: {
          title: TITLE,
          functionId,
          startsAt,
          combinesWith: {
            orderDiscounts: true,
            productDiscounts: true,
            shippingDiscounts: true,
          },
          metafields,
        },
      },
    );

    const errors = createResponse?.data?.discountAutomaticAppCreate?.userErrors ?? [];
    if (Array.isArray(errors) && errors.length > 0) {
      throw new Error(errors[0]?.message ?? "Failed to create BXGY discount");
    }

    const discountId = createResponse?.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId as
      | string
      | undefined;
    if (discountId) {
      const stored = await getShop(shop);
      await updateShopSettings(shop, {
        ...(stored?.settings ?? {}),
        bxgyDiscountId: discountId,
      });
    }
    return;
  }

  const updateResponse = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation UpdateAutomaticBxgyDiscount($id: ID!, $automaticAppDiscount: DiscountAutomaticAppInput!) {
        discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $automaticAppDiscount) {
          automaticAppDiscount {
            title
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      id: existing.id,
      automaticAppDiscount: {
        title: TITLE,
        startsAt,
        metafields,
      },
    },
  );

  const errors = updateResponse?.data?.discountAutomaticAppUpdate?.userErrors ?? [];
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Failed to update BXGY discount");
  }
}
