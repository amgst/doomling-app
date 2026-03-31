import { ProductDiscountSelectionStrategy } from '../generated/api';

/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

/**
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  const meta = input.discount?.metafield;

  let config;
  try { config = meta?.value ? JSON.parse(meta.value) : null; } catch { config = null; }

  // Support both old flat format and new tiers format
  let tiers = config?.tiers;
  if (!tiers && config?.threshold && config?.giftVariantId) {
    tiers = [{ threshold: config.threshold, giftVariantId: config.giftVariantId }];
  }

  // Collect all gift GIDs so we can exclude them from the threshold calculation
  const tierGiftGids = new Set(
    (tiers || []).map((t) => `gid://shopify/ProductVariant/${t.giftVariantId}`),
  );

  // Sum subtotal of non-gift lines
  const nonGiftSubtotal = input.cart.lines
    .filter((line) => !tierGiftGids.has(line.merchandise?.id))
    .reduce((sum, line) => sum + parseFloat(line.cost.subtotalAmount.amount), 0);

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
              value: { percentage: { value: 100 } },
            }],
            selectionStrategy: ProductDiscountSelectionStrategy.First,
          },
        });
      }
    }
  }

  // GWP line items (added on the storefront via /cart/add.js with properties)
  // are marked with cart line attributes: `_gwp=1` and `_gwp_main=<mainVariantId>`.
  const qtyByVariantGid = new Map(
    input.cart.lines.map((l) => [l.merchandise?.id, l.quantity]),
  );

  for (const line of input.cart.lines) {
    const isGwp = line.gwp?.value === "1";
    const mainVariantId = line.gwpMain?.value;
    if (!isGwp || !mainVariantId) continue;

    const mainGid = `gid://shopify/ProductVariant/${mainVariantId}`;
    const mainQty = qtyByVariantGid.get(mainGid) ?? 0;
    if (!mainQty) continue;

    // Don't discount if gift quantity exceeds qualifying main quantity.
    if (line.quantity > mainQty) continue;

    operations.push({
      productDiscountsAdd: {
        candidates: [{
          message: "Free Gift",
          targets: [{ cartLine: { id: line.id } }],
          value: { percentage: { value: 100 } },
        }],
        selectionStrategy: ProductDiscountSelectionStrategy.First,
      },
    });
  }

  return { operations };
}
