// node_modules/@shopify/shopify_function/run.ts
function run_default(userfunction) {
  try {
    ShopifyFunction;
  } catch (e) {
    throw new Error(
      "ShopifyFunction is not defined. Please rebuild your function using the latest version of Shopify CLI."
    );
  }
  const input_obj = ShopifyFunction.readInput();
  const output_obj = userfunction(input_obj);
  ShopifyFunction.writeOutput(output_obj);
}

// extensions/upsale-discount/src/cart_lines_discounts_generate_run.js
function cartLinesDiscountsGenerateRun(input) {
  const meta = input.discount?.metafield;
  if (!meta?.value) return { operations: [] };
  let config;
  try {
    config = JSON.parse(meta.value);
  } catch {
    return { operations: [] };
  }
  let tiers = config.tiers;
  if (!tiers && config.threshold && config.giftVariantId) {
    tiers = [{ threshold: config.threshold, giftVariantId: config.giftVariantId }];
  }
  if (!tiers?.length) return { operations: [] };
  const giftGids = new Set(
    tiers.map((t) => `gid://shopify/ProductVariant/${t.giftVariantId}`)
  );
  const nonGiftSubtotal = input.cart.lines.filter((line) => !giftGids.has(line.merchandise?.id)).reduce((sum, line) => sum + parseFloat(line.cost.subtotalAmount.amount), 0);
  const operations = [];
  for (const tier of tiers) {
    if (!tier.giftVariantId) continue;
    const giftGid = `gid://shopify/ProductVariant/${tier.giftVariantId}`;
    const giftLine = input.cart.lines.find((line) => line.merchandise?.id === giftGid);
    if (!giftLine) continue;
    if (nonGiftSubtotal >= parseFloat(tier.threshold)) {
      operations.push({
        productDiscountsAdd: {
          candidates: [{
            message: "Free Gift",
            targets: [{ cartLine: { id: giftLine.id } }],
            value: { percentage: { value: 100 } }
          }],
          selectionStrategy: "FIRST" /* First */
        }
      });
    }
  }
  return { operations };
}

// extensions/upsale-discount/src/cart_delivery_options_discounts_generate_run.js
function cartDeliveryOptionsDiscountsGenerateRun(input) {
  const firstDeliveryGroup = input.cart.deliveryGroups[0];
  if (!firstDeliveryGroup) {
    return { operations: [] };
  }
  const hasShippingDiscountClass = input.discount.discountClasses.includes(
    "SHIPPING" /* Shipping */
  );
  if (!hasShippingDiscountClass) {
    return { operations: [] };
  }
  return {
    operations: [
      {
        deliveryDiscountsAdd: {
          candidates: [
            {
              message: "FREE DELIVERY",
              targets: [
                {
                  deliveryGroup: {
                    id: firstDeliveryGroup.id
                  }
                }
              ],
              value: {
                percentage: {
                  value: 100
                }
              }
            }
          ],
          selectionStrategy: "ALL" /* All */
        }
      }
    ]
  };
}

// <stdin>
function cartLinesDiscountsGenerateRun2() {
  return run_default(cartLinesDiscountsGenerateRun);
}
function cartDeliveryOptionsDiscountsGenerateRun2() {
  return run_default(cartDeliveryOptionsDiscountsGenerateRun);
}
export {
  cartDeliveryOptionsDiscountsGenerateRun2 as cartDeliveryOptionsDiscountsGenerateRun,
  cartLinesDiscountsGenerateRun2 as cartLinesDiscountsGenerateRun
};
