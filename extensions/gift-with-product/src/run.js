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
 * Metafield config (namespace: "gwp", key: "gift_config"):
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
 * @param {object} input
 * @returns {{ operations: object[] }}
 */
export function run(input) {
  const meta = input.cartTransform?.metafield;

  if (!meta?.value) {
    console.error("[GWP] No metafield found on shop. namespace=gwp key=gift_config — has the app saved rules and synced to Shopify?");
    return { operations: [] };
  }

  let config;
  try {
    config = JSON.parse(meta.value);
  } catch {
    console.error("[GWP] Failed to parse metafield JSON:", meta.value);
    return { operations: [] };
  }

  const rules = config.rules;
  if (!Array.isArray(rules) || rules.length === 0) {
    console.error("[GWP] No rules found in config:", JSON.stringify(config));
    return { operations: [] };
  }

  console.error("[GWP] Loaded", rules.length, "rule(s)");

  const lines = input.cart.lines;
  const cartVariantIds = lines.map((l) => l.merchandise?.id);
  console.error("[GWP] Cart variants:", JSON.stringify(cartVariantIds));

  const operations = [];

  for (const rule of rules) {
    if (!rule.mainVariantId || !rule.giftVariantId) continue;

    const mainGid = `gid://shopify/ProductVariant/${rule.mainVariantId}`;
    const giftGid = `gid://shopify/ProductVariant/${rule.giftVariantId}`;

    const mainLine = lines.find((l) => l.merchandise?.id === mainGid);
    const giftAlreadyPresent = lines.some((l) => l.merchandise?.id === giftGid);

    console.error(`[GWP] Rule: main=${mainGid} gift=${giftGid} | mainInCart=${!!mainLine} giftAlready=${giftAlreadyPresent}`);

    if (!mainLine || giftAlreadyPresent) continue;

    operations.push({
      lineExpand: {
        cartLineId: mainLine.id,
        expandedCartItems: [
          {
            merchandiseId: mainGid,
            quantity: mainLine.quantity,
            price: { percentageDecrease: { value: 0 } },
          },
          {
            merchandiseId: giftGid,
            quantity: mainLine.quantity,
            price: { percentageDecrease: { value: 100 } },
            attributes: [
              { key: "_gwp", value: "1" },
              { key: "_gwp_main", value: String(rule.mainVariantId) },
            ],
          },
        ],
      },
    });
  }

  console.error("[GWP] Returning", operations.length, "operation(s)");
  return { operations };
}
