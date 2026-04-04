import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";
import { resolveAppDiscountType } from "@/lib/shopify/appDiscountType";
import type { BundleOffer } from "@/lib/shopify/bundleOfferStore";

function asProductGid(productId: string) {
  const value = String(productId || "").trim();
  return value.startsWith("gid://shopify/Product/")
    ? value
    : `gid://shopify/Product/${value.replace(/^gid:\/\/shopify\/Product\//, "")}`;
}

function activeEndsAt(offer: BundleOffer) {
  return offer.enabled ? null : new Date().toISOString();
}

function discountAmount(offer: BundleOffer) {
  const compareAt = Number(offer.compareAtPrice);
  const discounted = Number(offer.discountedPrice);
  const amount = compareAt - discounted;

  if (!Number.isFinite(compareAt) || !Number.isFinite(discounted) || amount <= 0) {
    throw new Error("Compare-at price must be greater than discounted price.");
  }

  return amount.toFixed(2);
}

function buildNativeDiscountInput(offer: BundleOffer) {
  return {
    title: offer.name,
    code: offer.code,
    startsAt: offer.createdAt || new Date().toISOString(),
    endsAt: activeEndsAt(offer),
    combinesWith: {
      orderDiscounts: false,
      productDiscounts: false,
      shippingDiscounts: false,
    },
    customerGets: {
      items: {
        products: {
          productsToAdd: [asProductGid(offer.productId)],
        },
      },
      value: {
        discountAmount: {
          amount: discountAmount(offer),
          appliesOnEachItem: true,
        },
      },
    },
  };
}

async function createNativeBundleOfferDiscount(shop: string, accessToken: string, offer: BundleOffer) {
  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation CreateNativeBundleDiscount($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
          }
          userErrors {
            field
            code
            message
          }
        }
      }
    `,
    {
      basicCodeDiscount: buildNativeDiscountInput(offer),
    },
  );

  const errors = response?.data?.discountCodeBasicCreate?.userErrors ?? [];
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Failed to create native bundle discount");
  }

  const discountId = response?.data?.discountCodeBasicCreate?.codeDiscountNode?.id;
  return typeof discountId === "string" && discountId ? discountId : undefined;
}

async function updateNativeBundleOfferDiscount(shop: string, accessToken: string, offer: BundleOffer) {
  if (!offer.discountId) return createNativeBundleOfferDiscount(shop, accessToken, offer);

  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation UpdateNativeBundleDiscount($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
          }
          userErrors {
            field
            code
            message
          }
        }
      }
    `,
    {
      id: offer.discountId,
      basicCodeDiscount: buildNativeDiscountInput(offer),
    },
  );

  const errors = response?.data?.discountCodeBasicUpdate?.userErrors ?? [];
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Failed to update native bundle discount");
  }

  const discountId = response?.data?.discountCodeBasicUpdate?.codeDiscountNode?.id;
  return typeof discountId === "string" && discountId ? discountId : offer.discountId;
}

async function archiveLegacyAppBundleOfferDiscount(shop: string, accessToken: string, offer: BundleOffer) {
  if (!offer.discountId) return;

  const { functionId, discountClasses } = await resolveAppDiscountType(shop, accessToken);
  const response = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation ArchiveLegacyBundleOfferCode($id: ID!, $codeAppDiscount: DiscountCodeAppInput!) {
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
        discountClasses,
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
            value: JSON.stringify({
              version: 1,
              bundleOffers: [],
            }),
          },
        ],
      },
    },
  );

  const errors = response?.data?.discountCodeAppUpdate?.userErrors ?? [];
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Failed to archive legacy bundle discount");
  }
}

export async function syncBundleOfferDiscount(shop: string, accessToken: string, offer: BundleOffer) {
  try {
    return await updateNativeBundleOfferDiscount(shop, accessToken, offer);
  } catch (error) {
    if (!offer.discountId) throw error;

    await archiveLegacyAppBundleOfferDiscount(shop, accessToken, offer);
    return createNativeBundleOfferDiscount(shop, accessToken, {
      ...offer,
      discountId: undefined,
    });
  }
}

export async function archiveBundleOfferDiscount(shop: string, accessToken: string, offer: BundleOffer) {
  try {
    await updateNativeBundleOfferDiscount(shop, accessToken, {
      ...offer,
      enabled: false,
    });
  } catch (error) {
    if (!offer.discountId) return;
    await archiveLegacyAppBundleOfferDiscount(shop, accessToken, offer);
  }
}
