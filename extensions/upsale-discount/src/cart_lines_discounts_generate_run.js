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
  // Read promotion config from discount metafield
  const meta = input.discount?.metafield;
  if (!meta?.value) return { operations: [] };

  let config;
  try { config = JSON.parse(meta.value); } catch { return { operations: [] }; }

  const { threshold, giftVariantId } = config;
  if (!threshold || !giftVariantId) return { operations: [] };

  const giftGid = `gid://shopify/ProductVariant/${giftVariantId}`;

  // Find the gift line in cart
  const giftLine = input.cart.lines.find(line => line.merchandise?.id === giftGid);
  if (!giftLine) return { operations: [] };

  // Sum subtotal of non-gift lines to check threshold
  const nonGiftSubtotal = input.cart.lines
    .filter(line => line.merchandise?.id !== giftGid)
    .reduce((sum, line) => sum + parseFloat(line.cost.subtotalAmount.amount), 0);

  if (nonGiftSubtotal < parseFloat(threshold)) return { operations: [] };

  // Apply 100% discount to the gift line
  return {
    operations: [{
      productDiscountsAdd: {
        candidates: [{
          message: 'Free Gift',
          targets: [{ cartLine: { id: giftLine.id } }],
          value: { percentage: { value: 100 } },
        }],
        selectionStrategy: ProductDiscountSelectionStrategy.First,
      },
    }],
  };
}
