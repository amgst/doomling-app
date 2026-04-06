function toNumber(value) {
  return Math.max(Number(value) || 0, 0);
}

function totalQtyByVariants(cart, variantIds) {
  const ids = new Set((variantIds || []).map(String));
  return ((cart && cart.items) || []).reduce((sum, item) => {
    const props = item && item.properties ? item.properties : {};
    if (String(props._bxgy || "") === "true") return sum;
    return ids.has(String(item.variant_id)) ? sum + toNumber(item.quantity) : sum;
  }, 0);
}

function findAutoGiftLine(cart, variantId, ruleId) {
  return ((cart && cart.items) || []).find((item) => {
    if (String(item.variant_id) !== String(variantId)) return false;
    const props = item.properties || {};
    return String(props._bxgy || "") === "true" && String(props._bxgy_rule_id || "") === String(ruleId);
  }) || null;
}

function hasManualGift(cart, variantId) {
  return ((cart && cart.items) || []).some((item) => {
    if (String(item.variant_id) !== String(variantId)) return false;
    const props = item.properties || {};
    return String(props._bxgy || "") !== "true";
  });
}

function giftKey(ruleId, variantId) {
  return `${ruleId}:${variantId}`;
}

function normalizeDismissedState(dismissedState, ttlMs, now) {
  const next = { ...(dismissedState || {}) };
  Object.keys(next).forEach((key) => {
    const entry = next[key];
    if (!entry || typeof entry !== "object") {
      delete next[key];
      return;
    }
    const dismissedAt = toNumber(entry.dismissedAt);
    if (!dismissedAt || now - dismissedAt > ttlMs) {
      delete next[key];
    }
  });
  return next;
}

function updateDismissedState(prevCart, cart, rule, dismissedState, now, ttlMs = 30 * 60 * 1000) {
  const nextState = normalizeDismissedState(dismissedState, ttlMs, now);
  const key = giftKey(rule.ruleId, rule.giftVariantId);
  const buyQty = totalQtyByVariants(cart, rule.buyVariantIds);
  const bundleCount = Math.floor(buyQty / Math.max(toNumber(rule.buyQuantity), 1));
  const nextGiftLine = findAutoGiftLine(cart, rule.giftVariantId, rule.ruleId);
  const prevGiftLine = findAutoGiftLine(prevCart, rule.giftVariantId, rule.ruleId);
  const manualGift = hasManualGift(cart, rule.giftVariantId);

  if (bundleCount <= 0 || nextGiftLine || manualGift) {
    delete nextState[key];
    return nextState;
  }

  if (prevGiftLine && !nextGiftLine) {
    nextState[key] = { buyQty, dismissedAt: now };
  }

  return nextState;
}

function isDismissed(dismissedState, rule, buyQty, now, ttlMs = 30 * 60 * 1000) {
  const entry = (dismissedState || {})[giftKey(rule.ruleId, rule.giftVariantId)];
  if (!entry || typeof entry !== "object") return false;
  const dismissedAt = toNumber(entry.dismissedAt);
  if (!dismissedAt || now - dismissedAt > ttlMs) return false;
  return toNumber(entry.buyQty) === toNumber(buyQty) && toNumber(buyQty) > 0;
}

function evaluateRule(cart, rule, dismissedState = {}, now = Date.now(), ttlMs = 30 * 60 * 1000) {
  const buyQty = totalQtyByVariants(cart, rule.buyVariantIds);
  const giftLine = findAutoGiftLine(cart, rule.giftVariantId, rule.ruleId);
  const manualGift = hasManualGift(cart, rule.giftVariantId);
  const bundleCount = Math.floor(buyQty / Math.max(toNumber(rule.buyQuantity), 1));
  const scaledGiftQty = bundleCount * Math.max(toNumber(rule.giftQuantity), 1);
  const cappedGiftQty = buyQty >= Math.max(toNumber(rule.buyQuantity), 1) ? Math.max(toNumber(rule.giftQuantity), 1) : 0;
  const desiredQty =
    manualGift || isDismissed(dismissedState, rule, buyQty, now, ttlMs)
      ? 0
      : (rule.limitOneGiftPerOrder ? cappedGiftQty : scaledGiftQty);

  return {
    buyQty,
    bundleCount,
    hasGiftLine: Boolean(giftLine),
    currentGiftQty: giftLine ? toNumber(giftLine.quantity) : 0,
    manualGift,
    desiredQty,
    shouldAdd: !giftLine && desiredQty > 0,
    shouldRemove: Boolean(giftLine) && desiredQty === 0,
    shouldUpdate: Boolean(giftLine) && desiredQty > 0 && toNumber(giftLine.quantity) !== desiredQty,
  };
}

module.exports = {
  totalQtyByVariants,
  findAutoGiftLine,
  hasManualGift,
  normalizeDismissedState,
  updateDismissedState,
  evaluateRule,
};
