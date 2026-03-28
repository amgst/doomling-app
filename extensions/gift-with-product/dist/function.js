// extensions/gift-with-product/node_modules/@shopify/shopify_function/run.ts
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

// extensions/gift-with-product/src/run.js
function run(input) {
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
  const operations = [];
  for (const rule of rules) {
    if (!rule.mainVariantId || !rule.giftVariantId) continue;
    const mainGid = `gid://shopify/ProductVariant/${rule.mainVariantId}`;
    const giftGid = `gid://shopify/ProductVariant/${rule.giftVariantId}`;
    const mainLine = lines.find((l) => l.merchandise?.id === mainGid);
    const giftAlreadyPresent = lines.some((l) => l.merchandise?.id === giftGid);
    if (!mainLine || giftAlreadyPresent) continue;
    operations.push({
      expand: {
        cartLineId: mainLine.id,
        expandedCartItems: [
          {
            merchandiseId: mainGid,
            quantity: mainLine.quantity,
            price: { percentageDecrease: { value: 0 } }
          },
          {
            merchandiseId: giftGid,
            quantity: mainLine.quantity,
            price: { percentageDecrease: { value: 100 } }
          }
        ]
      }
    });
  }
  return { operations };
}

// <stdin>
function run2() {
  return run_default(run);
}
export {
  run2 as run
};
