import { syncGiftConfigToCartTransform } from "@/lib/shopify/cartTransformGiftConfig";
import { getGiftRulesFromMetaobjects, type GiftRule } from "@/lib/shopify/gwpRuleStore";
import { setShopGiftRulesMetafield } from "@/lib/shopify/shopGiftRulesMetafield";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function syncGiftRuleDerivedState(shop: string, accessToken: string) {
  const rules = await getGiftRulesFromMetaobjects(shop, accessToken);

  let ctSync: unknown = "not_attempted";
  try {
    ctSync = await syncGiftConfigToCartTransform(shop, accessToken, rules);
  } catch (e) {
    ctSync = { error: errorMessage(e) };
  }

  let shopRulesSync: unknown = "not_attempted";
  try {
    await setShopGiftRulesMetafield(shop, accessToken, rules);
    shopRulesSync = { ok: true };
  } catch (e) {
    shopRulesSync = { error: errorMessage(e) };
  }

  return {
    rules,
    ctSync,
    shopRulesSync,
  };
}

export type { GiftRule };
