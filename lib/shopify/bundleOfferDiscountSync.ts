import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";
import { resolveAppDiscountType } from "@/lib/shopify/appDiscountType";
import type { BundleOffer } from "@/lib/shopify/bundleOfferStore";

function buildConfig(offer: BundleOffer) {
  const productId = String(offer.productId || "").trim();
  const productGid = productId.startsWith("gid://shopify/Product/")
    ? productId
    : `gid://shopify/Product/${productId.replace(/^gid:\/\/shopify\/Product\//, "")}`;
  return {
    version: 1,
    bundleOffers: [
      {
        offerId: offer.id,
        productId: productGid,
        code: offer.code,
        discountedPrice: Number(offer.discountedPrice),
      },
    ],
  };
}

function activeEndsAt(offer: BundleOffer) {
  return offer.enabled ? null : new Date().toISOString();
}

export async function syncBundleOfferDiscount(shop: string, accessToken: string, offer: BundleOffer) {
  const { functionId } = await resolveAppDiscountType(shop, accessToken);
  const metafields = [
    {
      namespace: "upsale",
      key: "config",
      type: "json",
      value: JSON.stringify(buildConfig(offer)),
    },
  ];

  const codeAppDiscount = {
    title: offer.name,
    code: offer.code,
    functionId,
    startsAt: offer.createdAt || new Date().toISOString(),
    endsAt: activeEndsAt(offer),
    combinesWith: {
      orderDiscounts: false,
      productDiscounts: false,
      shippingDiscounts: false,
    },
    metafields,
  };

  if (!offer.discountId) {
    const createResponse = await shopifyAdminGraphql(
      shop,
      accessToken,
      `
        mutation CreateBundleOfferCode($codeAppDiscount: DiscountCodeAppInput!) {
          discountCodeAppCreate(codeAppDiscount: $codeAppDiscount) {
            codeAppDiscount {
              discountId
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      { codeAppDiscount },
    );

    const errors = createResponse?.data?.discountCodeAppCreate?.userErrors ?? [];
    if (Array.isArray(errors) && errors.length > 0) {
      throw new Error(errors[0]?.message ?? "Failed to create bundle offer discount");
    }

    const discountId = createResponse?.data?.discountCodeAppCreate?.codeAppDiscount?.discountId;
    return typeof discountId === "string" && discountId ? discountId : undefined;
  }

  const updateResponse = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation UpdateBundleOfferCode($id: ID!, $codeAppDiscount: DiscountCodeAppInput!) {
        discountCodeAppUpdate(id: $id, codeAppDiscount: $codeAppDiscount) {
          codeAppDiscount {
            discountId
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      id: offer.discountId,
      codeAppDiscount,
    },
  );

  const errors = updateResponse?.data?.discountCodeAppUpdate?.userErrors ?? [];
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Failed to update bundle offer discount");
  }

  return offer.discountId;
}

export async function archiveBundleOfferDiscount(shop: string, accessToken: string, offer: BundleOffer) {
  if (!offer.discountId) return;

  const { functionId } = await resolveAppDiscountType(shop, accessToken);
  const updateResponse = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation ArchiveBundleOfferCode($id: ID!, $codeAppDiscount: DiscountCodeAppInput!) {
        discountCodeAppUpdate(id: $id, codeAppDiscount: $codeAppDiscount) {
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      id: offer.discountId,
      codeAppDiscount: {
        title: offer.name,
        code: offer.code,
        functionId,
        startsAt: offer.createdAt || new Date().toISOString(),
        endsAt: new Date().toISOString(),
        combinesWith: {
          orderDiscounts: false,
          productDiscounts: false,
          shippingDiscounts: false,
        },
        metafields: [
          {
            namespace: "upsale",
            key: "config",
            type: "json",
            value: JSON.stringify(buildConfig({ ...offer, enabled: false })),
          },
        ],
      },
    },
  );

  const errors = updateResponse?.data?.discountCodeAppUpdate?.userErrors ?? [];
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Failed to archive bundle offer discount");
  }
}
