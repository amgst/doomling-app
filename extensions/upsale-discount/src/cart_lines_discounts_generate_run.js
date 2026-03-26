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
  if (!meta?.value) return { operations: [] };

  let config;
  try { config = JSON.parse(meta.value); } catch { return { operations: [] }; }

  // Support both old flat format and new tiers format
  let tiers = config.tiers;
  if (!tiers && config.threshold && config.giftVariantId) {
    tiers = [{ threshold: config.threshold, giftVariantId: config.giftVariantId }];
  }
  if (!tiers?.length) return { operations: [] };

  // Collect all gift GIDs so we can exclude them from the threshold calculation
  const giftGids = new Set(
    tiers.map(t => `gid://shopify/ProductVariant/${t.giftVariantId}`)
  );

  // Sum subtotal of non-gift lines
  const nonGiftSubtotal = input.cart.lines
    .filter(line => !giftGids.has(line.merchandise?.id))
    .reduce((sum, line) => sum + parseFloat(line.cost.subtotalAmount.amount), 0);

  const operations = [];

  for (const tier of tiers) {
    if (!tier.giftVariantId) continue;
    const giftGid = `gid://shopify/ProductVariant/${tier.giftVariantId}`;
    const giftLine = input.cart.lines.find(line => line.merchandise?.id === giftGid);
    if (!giftLine) continue;

    if (nonGiftSubtotal >= parseFloat(tier.threshold)) {
      operations.push({
        productDiscountsAdd: {
          candidates: [{
            message: 'Free Gift',
            targets: [{ cartLine: { id: giftLine.id } }],
            value: { percentage: { value: 100 } },
          }],
          selectionStrategy: ProductDiscountSelectionStrategy.First,
        },
      });
    }
  }

  return { operations };
}
