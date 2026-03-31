import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";
import type { UpsellRule } from "@/lib/shopify/upsellRuleStore";

const NS = "upsell";
const KEY = "rules";

export async function setShopUpsellRulesMetafield(shop: string, accessToken: string, rules: UpsellRule[]) {
  const shopData = await shopifyAdminGraphql(shop, accessToken, `query GetShopId { shop { id } }`);
  const shopId = shopData?.data?.shop?.id as string | undefined;
  if (!shopId) throw new Error("Could not get Shop ID");

  const value = JSON.stringify({ rules: rules ?? [] });
  const res = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation SetUpsellRules($ownerId: ID!, $value: String!) {
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
    { ownerId: shopId, value },
  );

  const errors = res?.data?.metafieldsSet?.userErrors ?? [];
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(errors[0].message ?? "Failed to set upsell rules metafield");
  }
}

export async function getShopUpsellRulesMetafield(shop: string, accessToken: string): Promise<UpsellRule[]> {
  const data = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query GetUpsellRules {
        shop { upsellRules: metafield(namespace: "${NS}", key: "${KEY}") { value } }
      }
    `,
  );

  const raw = data?.data?.shop?.upsellRules?.value as string | undefined;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.rules) ? (parsed.rules as UpsellRule[]) : [];
  } catch {
    return [];
  }
}

