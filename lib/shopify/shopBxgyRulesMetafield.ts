import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";
import type { BxgyRule } from "@/lib/shopify/bxgyRuleStore";

const NS = "upsale";
const KEY = "bxgy_rules";

export async function setShopBxgyRulesMetafield(shop: string, accessToken: string, rules: BxgyRule[]) {
  const shopData = await shopifyAdminGraphql(shop, accessToken, `query GetShopId { shop { id } }`);
  const shopId = shopData?.data?.shop?.id as string | undefined;
  if (!shopId) throw new Error("Could not get Shop ID");

  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation SetBxgyRules($ownerId: ID!, $value: String!) {
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
    throw new Error(errors[0]?.message ?? "Failed to set BXGY rules metafield");
  }
}

export async function getShopBxgyRulesMetafield(shop: string, accessToken: string): Promise<BxgyRule[]> {
  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query GetBxgyRules {
        shop {
          bxgyRules: metafield(namespace: "${NS}", key: "${KEY}") {
            value
          }
        }
      }
    `,
  );

  const raw = response?.data?.shop?.bxgyRules?.value as string | undefined;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.rules) ? (parsed.rules as BxgyRule[]) : [];
  } catch {
    return [];
  }
}
