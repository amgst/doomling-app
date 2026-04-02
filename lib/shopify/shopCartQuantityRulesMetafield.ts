import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";

const NS = "upsale";
const KEY = "cart_quantity_rules";

export interface CartQuantityRule {
  id: string;
  productId: string;
  productTitle: string;
  quantity: number;
  enabled: boolean;
}

export async function setShopCartQuantityRulesMetafield(
  shop: string,
  accessToken: string,
  rules: CartQuantityRule[],
) {
  const shopData = await shopifyAdminGraphql(shop, accessToken, `query GetShopId { shop { id } }`);
  const shopId = shopData?.data?.shop?.id as string | undefined;
  if (!shopId) throw new Error("Could not get Shop ID");

  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation SetCartQuantityRules($ownerId: ID!, $value: String!) {
        metafieldsSet(metafields: [{
          ownerId: $ownerId
          namespace: "${NS}"
          key: "${KEY}"
          type: "json"
          value: $value
        }]) {
          metafields { id }
          userErrors { field message }
        }
      }
    `,
    {
      ownerId: shopId,
      value: JSON.stringify({ rules: rules ?? [] }),
    },
  );

  const errors = response?.data?.metafieldsSet?.userErrors ?? [];
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Failed to save cart quantity rules");
  }
}

export async function getShopCartQuantityRulesMetafield(
  shop: string,
  accessToken: string,
): Promise<CartQuantityRule[]> {
  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query GetCartQuantityRules {
        shop {
          cartQuantityRules: metafield(namespace: "${NS}", key: "${KEY}") {
            value
          }
        }
      }
    `,
  );

  const raw = response?.data?.shop?.cartQuantityRules?.value as string | undefined;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.rules) ? (parsed.rules as CartQuantityRule[]) : [];
  } catch {
    return [];
  }
}
