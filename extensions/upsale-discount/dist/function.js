// extensions/upsale-discount/node_modules/@shopify/shopify_function/run.ts
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
  let config;
  try {
    config = meta?.value ? JSON.parse(meta.value) : null;
  } catch {
    config = null;
  }
  let tiers = config?.tiers;
  if (!tiers && config?.threshold && config?.giftVariantId) {
    tiers = [{ threshold: config.threshold, giftVariantId: config.giftVariantId }];
  }
  const tierGiftGids = new Set(
    (tiers || []).map((t) => `gid://shopify/ProductVariant/${t.giftVariantId}`)
  );
  const nonGiftSubtotal = input.cart.lines.filter((line) => !tierGiftGids.has(line.merchandise?.id)).reduce((sum, line) => sum + parseFloat(line.cost.subtotalAmount.amount), 0);
  const operations = [];
  if (Array.isArray(tiers) && tiers.length > 0) {
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
  }
  const qtyByVariantGid = new Map(
    input.cart.lines.map((l) => [l.merchandise?.id, l.quantity])
  );
  for (const line of input.cart.lines) {
    const isGwp = line.gwp?.value === "1";
    const mainVariantId = line.gwpMain?.value;
    if (!isGwp || !mainVariantId) continue;
    const mainGid = `gid://shopify/ProductVariant/${mainVariantId}`;
    const mainQty = qtyByVariantGid.get(mainGid) ?? 0;
    if (!mainQty) continue;
    if (line.quantity > mainQty) continue;
    operations.push({
      productDiscountsAdd: {
        candidates: [{
          message: "Free Gift",
          targets: [{ cartLine: { id: line.id } }],
          value: { percentage: { value: 100 } }
        }],
        selectionStrategy: "FIRST" /* First */
      }
    });
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
