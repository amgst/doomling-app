import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";
import type { PostPurchaseOffer } from "@/lib/shopify/postPurchaseOfferStore";

const NS = "upsell";
const KEY = "post_purchase_offers";

export async function setShopPostPurchaseOffersMetafield(
  shop: string,
  accessToken: string,
  offers: PostPurchaseOffer[],
) {
  const shopData = await shopifyAdminGraphql(shop, accessToken, `query GetShopId { shop { id } }`);
  const shopId = shopData?.data?.shop?.id as string | undefined;
  if (!shopId) throw new Error("Could not get Shop ID");

  const value = JSON.stringify({ offers: offers ?? [] });
  const res = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation SetPostPurchaseOffers($ownerId: ID!, $value: String!) {
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
    throw new Error(errors[0].message ?? "Failed to set post-purchase offers metafield");
  }
}
