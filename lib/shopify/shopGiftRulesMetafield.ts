import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";
import type { GiftRule } from "@/lib/firebase/giftRuleStore";

const NS = "gwp";
const KEY = "gift_rules";

export async function getShopGiftRulesMetafield(shop: string, accessToken: string): Promise<GiftRule[]> {
  const res = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      query GetShopGiftRules {
        shop {
          giftRules: metafield(namespace: "${NS}", key: "${KEY}") { value }
        }
      }
    `,
  );

  const raw = res?.data?.shop?.giftRules?.value as string | undefined;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.rules) ? (parsed.rules as GiftRule[]) : [];
  } catch {
    return [];
  }
}

export async function setShopGiftRulesMetafield(shop: string, accessToken: string, rules: GiftRule[]) {
  const shopData = await shopifyAdminGraphql(shop, accessToken, `query GetShopId { shop { id } }`);
  const shopId = shopData?.data?.shop?.id as string | undefined;
  if (!shopId) throw new Error("Could not get Shop ID");

  const value = JSON.stringify({ rules: rules ?? [] });
  const res = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation SetShopGiftRules($ownerId: ID!, $value: String!) {
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
    throw new Error(errors[0].message ?? "Failed to set shop metafield");
  }
}
