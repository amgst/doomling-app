import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";

export type AppDiscountTypeRecord = {
  functionId: string;
  discountClasses: string[];
};

const cache = new Map<string, AppDiscountTypeRecord>();

export async function resolveAppDiscountType(shop: string, accessToken: string): Promise<AppDiscountTypeRecord> {
  const cached = cache.get(shop);
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
  const discountClasses = Array.isArray(preferred?.discountClasses)
    ? preferred.discountClasses
        .map((entry: unknown) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    : [];

  if (!functionId) {
    throw new Error(
      "Could not find the released Shopify Function ID from Shopify Admin. Make sure the current app version with the discount function is installed on this store.",
    );
  }

  if (discountClasses.length === 0) {
    throw new Error(
      "Shopify did not return any discount classes for the released discount function. Re-release the function and try again.",
    );
  }

  const record = { functionId, discountClasses };
  cache.set(shop, record);
  return record;
}
