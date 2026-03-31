import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";
import type { GiftRule } from "@/lib/firebase/giftRuleStore";

const NS = "gwp";
const KEY = "gift_config";
const DEFAULT_FUNCTION_HANDLE = "gift-with-product";

export async function syncGiftConfigToCartTransform(
  shop: string,
  accessToken: string,
  rules: GiftRule[],
) {
  // 1) Prefer function handle (defined in `extensions/gift-with-product/shopify.extension.toml`)
  // NOTE: `extensions[].uid` is NOT a Shopify Function id (gid://shopify/Function/...), it's an extension UID.
  const fnHandle = (process.env.SHOPIFY_GIFT_FUNCTION_HANDLE ?? DEFAULT_FUNCTION_HANDLE).trim();

  if (!fnHandle) {
    return {
      error: "No function identifier configured",
      help: {
        recommended: `Set SHOPIFY_GIFT_FUNCTION_HANDLE=${DEFAULT_FUNCTION_HANDLE}`,
        note: "Cart transform create by function handle is the recommended approach.",
      },
    };
  }

  const fetchTransforms = async () => {
    const ctData = await shopifyAdminGraphql(
      shop,
      accessToken,
      `
        query GetCTs {
          cartTransforms(first: 25) {
            nodes {
              id
              functionId
              metafield(namespace: "${NS}", key: "${KEY}") { id }
            }
          }
        }
      `,
    );
    return ctData?.data?.cartTransforms?.nodes ?? [];
  };

  // 2) Query for existing CartTransform (no external caching)
  let ctId: string | null = null;
  const transforms = await fetchTransforms();
  const matchByMeta = transforms.find((t: any) => !!t?.metafield?.id);
  ctId = (matchByMeta?.id ?? null) as string | null;

  if (!ctId) {
    const createData = await shopifyAdminGraphql(
      shop,
      accessToken,
      `
        mutation CreateCT($fnHandle: String!) {
          cartTransformCreate(functionHandle: $fnHandle) {
            cartTransform { id }
            userErrors { field message code }
          }
        }
      `,
      { fnHandle },
    );

    ctId = (createData as any)?.data?.cartTransformCreate?.cartTransform?.id ?? null;
    const userErrors = (createData as any)?.data?.cartTransformCreate?.userErrors ?? [];

    if (!ctId && userErrors.length > 0) {
      const retry = await fetchTransforms();
      const retryByMeta = retry.find((t: any) => !!t?.metafield?.id);
      ctId = (retryByMeta?.id ?? null) as string | null;
    }

    if (!ctId && userErrors.length > 0) {
      return {
        error: "Could not create CartTransform",
        userErrors,
        using: fnGid ? { functionId: fnGid } : { functionHandle: fnHandle },
        hint: "If this says the function was not found, deploy/release the function in THIS app and reinstall the app on the store.",
      };
    }

  }

  if (!ctId) return { error: "No CartTransform ID found" };

  const value = JSON.stringify({ rules: rules ?? [] });
  const syncData = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation SetMeta($ownerId: ID!, $value: String!) {
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
    { ownerId: ctId, value },
  );

  return {
    ctId,
    metafields: syncData?.data?.metafieldsSet?.metafields ?? [],
    userErrors: syncData?.data?.metafieldsSet?.userErrors ?? [],
    topErrors: syncData?.errors ?? null,
  };
}
