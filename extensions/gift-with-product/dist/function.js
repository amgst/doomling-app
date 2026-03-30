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
  if (!meta?.value) {
    console.error("[GWP] No metafield found on shop. namespace=gwp key=gift_config \u2014 has the app saved rules and synced to Shopify?");
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
  console.error("[GWP] Returning", operations.length, "operation(s)");
  return { operations };
}

// <stdin>
function run2() {
  return run_default(run);
}
export {
  run2 as run
};
