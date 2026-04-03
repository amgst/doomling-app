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

  const bundleOffers = Array.isArray(config?.bundleOffers) ? config.bundleOffers : null;
  if (bundleOffers && bundleOffers.length > 0) {
    const candidates = [];

    for (const offer of bundleOffers) {
      const productId = String(offer?.productId ?? "");
      const discountedPrice = Number(offer?.discountedPrice);
      const code = String(offer?.code ?? "");
      const message = String(offer?.code || offer?.name || "Bundle offer");

      if (!productId || !Number.isFinite(discountedPrice) || discountedPrice < 0) continue;

      for (const line of input.cart.lines) {
        const lineProductId = String(line.merchandise?.product?.id ?? "");
        if (lineProductId !== productId) continue;

        const quantity = Math.max(Number(line.quantity) || 0, 0);
        if (quantity <= 0) continue;

        const lineSubtotal = Number(line.cost?.subtotalAmount?.amount ?? 0);
        const currentUnitPrice = quantity > 0 ? lineSubtotal / quantity : 0;
        const amountOffPerItem = Math.max(currentUnitPrice - discountedPrice, 0);
        if (amountOffPerItem <= 0) continue;

        candidates.push({
          message,
          ...(code ? { associatedDiscountCode: { code } } : {}),
          targets: [{ cartLine: { id: line.id } }],
          value: {
            fixedAmount: {
              amount: amountOffPerItem.toFixed(2),
              appliesToEachItem: true,
            },
          },
        });
      }
    }

    if (candidates.length > 0) {
      return {
        operations: [{
          productDiscountsAdd: {
            candidates,
            selectionStrategy: ProductDiscountSelectionStrategy.All,
          },
        }],
      };
    }

    return { operations: [] };
  }

  const bxgyRules = Array.isArray(config?.bxgyRules) ? config.bxgyRules : null;
  if (bxgyRules && bxgyRules.length > 0) {
    const candidates = [];

    for (const rule of bxgyRules) {
      const buyVariantIds = Array.isArray(rule?.buyVariantIds) ? rule.buyVariantIds : [];
      const giftVariantId = String(rule?.giftVariantId ?? "");
      const buyQuantity = Math.max(Number(rule?.buyQuantity) || 1, 1);
      const giftQuantity = Math.max(Number(rule?.giftQuantity) || 1, 1);
      const ruleId = String(rule?.ruleId ?? "");

      if (!buyVariantIds.length || !giftVariantId || !ruleId) continue;

      const qualifyingQty = input.cart.lines.reduce((sum, line) => {
        if (line.attribute?.value === "true") return sum;
        return buyVariantIds.includes(line.merchandise?.id) ? sum + (line.quantity || 0) : sum;
      }, 0);

      const eligibleGiftQty = Math.floor(qualifyingQty / buyQuantity) * giftQuantity;
      if (eligibleGiftQty <= 0) continue;

      const giftLines = input.cart.lines.filter((line) =>
        line.merchandise?.id === giftVariantId && line.rule?.value === ruleId,
      );

      let remainingQty = eligibleGiftQty;
      for (const giftLine of giftLines) {
        if (remainingQty <= 0) break;
        const discountQty = Math.min(giftLine.quantity || 0, remainingQty);
        if (discountQty <= 0) continue;

        candidates.push({
          message: "Free gift",
          targets: [{ cartLine: { id: giftLine.id, quantity: discountQty } }],
          value: { percentage: { value: 100 } },
        });
        remainingQty -= discountQty;
      }
    }

    if (candidates.length > 0) {
      return {
        operations: [{
          productDiscountsAdd: {
            candidates,
            selectionStrategy: ProductDiscountSelectionStrategy.All,
          },
        }],
      };
    }

    return { operations: [] };
  }

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

  return { operations };
}
