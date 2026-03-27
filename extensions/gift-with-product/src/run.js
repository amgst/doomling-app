/**
 * Gift With Product — Cart Transform Function
 *
 * Behaviour:
 *  - When a configured main variant is in the cart, the function expands that
 *    line into two components: [main product, gift product @ $0].
 *  - Gift quantity always equals main product quantity.
 *  - When the main product is removed, the expansion no longer applies and the
 *    gift disappears automatically (stateless, recalculated on every cart update).
 *  - Removing the gift component does NOT remove the main product.
 *  - Duplicate gifts are prevented: if a gift variant is already present as a
 *    standalone line the expand is skipped for that rule.
 *
 * Metafield config (namespace: "upsale", key: "gift_config"):
 *   {
 *     "rules": [
 *       { "mainVariantId": "12345678901", "giftVariantId": "98765432109" }
 *     ]
 *   }
 *
 * Note: Cart Transform functions are stateless. If a customer removes the gift
 * component, it will be re-added on the next cart interaction because the
 * function still sees the main product in the cart. To make gift removal
 * "sticky" you would need a cart attribute set by a theme extension to signal
 * user intent, which can then be read in this function.
 *
 * @typedef {import("../generated/api").InputQuery}  RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const meta = input.cartTransform?.metafield;
  if (!meta?.value) return { operations: [] };

  let config;
  try {
    config = JSON.parse(meta.value);
  } catch {
    return { operations: [] };
  }

  const rules = config.rules;
  if (!Array.isArray(rules) || rules.length === 0) return { operations: [] };

  const lines = input.cart.lines;
  const currency =
    input.cart.cost?.totalAmount?.currencyCode ?? 'USD';

  const operations = [];

  for (const rule of rules) {
    if (!rule.mainVariantId || !rule.giftVariantId) continue;

    const mainGid = `gid://shopify/ProductVariant/${rule.mainVariantId}`;
    const giftGid = `gid://shopify/ProductVariant/${rule.giftVariantId}`;

    // Find the main product line (should be at most one after Shopify consolidates)
    const mainLine = lines.find((l) => l.merchandise?.id === mainGid);

    // Gift is already present as a standalone line — skip to avoid duplicates.
    // (When expand runs, the gift appears as a component, not a standalone line,
    //  so this check primarily guards against the gift being added via storefront API.)
    const giftAlreadyPresent = lines.some((l) => l.merchandise?.id === giftGid);

    if (!mainLine || giftAlreadyPresent) continue;

    // Preserve the main product's original unit price so the customer is not
    // overcharged. The gift component is added at $0.
    const mainUnitAmount =
      mainLine.cost?.amountPerQuantity?.amount ?? '0.00';
    const mainUnitCurrency =
      mainLine.cost?.amountPerQuantity?.currencyCode ?? currency;

    operations.push({
      expand: {
        cartLineId: mainLine.id,
        expandedCartItems: [
          {
            merchandiseId: mainGid,
            quantity: mainLine.quantity,
            price: {
              fixedPricePerUnit: {
                amount: mainUnitAmount,
                currencyCode: mainUnitCurrency,
              },
            },
          },
          {
            merchandiseId: giftGid,
            quantity: mainLine.quantity,
            price: {
              fixedPricePerUnit: {
                amount: '0.00',
                currencyCode: currency,
              },
            },
          },
        ],
      },
    });
  }

  return { operations };
}
