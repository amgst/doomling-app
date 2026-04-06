const assert = require("node:assert/strict");

const {
  totalQtyByVariants,
  updateDismissedState,
  evaluateRule,
} = require("../lib/shopify/bxgyQa");

const RULE = {
  ruleId: "rule-1",
  buyVariantIds: ["buy-1"],
  giftVariantId: "gift-1",
  buyQuantity: 1,
  giftQuantity: 1,
  limitOneGiftPerOrder: false,
};

function line(variantId, quantity, properties = {}) {
  return {
    variant_id: variantId,
    quantity,
    properties,
    key: `${variantId}:${quantity}:${properties._bxgy_rule_id || "manual"}`,
  };
}

function cart(items) {
  return { items };
}

const cases = [
  {
    name: "auto gift lines do not count toward buy quantity",
    run() {
      const buyQty = totalQtyByVariants(
        cart([
          line("buy-1", 1),
          line("buy-1", 1, { _bxgy: "true", _bxgy_rule_id: "rule-1" }),
        ]),
        ["buy-1"],
      );
      assert.equal(buyQty, 1);
    },
  },
  {
    name: "qualifying cart adds one gift once",
    run() {
      const result = evaluateRule(cart([line("buy-1", 1)]), RULE);
      assert.equal(result.desiredQty, 1);
      assert.equal(result.shouldAdd, true);
      assert.equal(result.shouldRemove, false);
      assert.equal(result.shouldUpdate, false);
    },
  },
  {
    name: "existing gift with wrong quantity updates instead of duplicating",
    run() {
      const result = evaluateRule(
        cart([
          line("buy-1", 1),
          line("gift-1", 2, { _bxgy: "true", _bxgy_rule_id: "rule-1" }),
        ]),
        RULE,
      );
      assert.equal(result.desiredQty, 1);
      assert.equal(result.shouldAdd, false);
      assert.equal(result.shouldUpdate, true);
    },
  },
  {
    name: "manual gift removal is remembered for the same qualifying cart state",
    run() {
      const now = 1_000_000;
      const prevCart = cart([
        line("buy-1", 1),
        line("gift-1", 1, { _bxgy: "true", _bxgy_rule_id: "rule-1" }),
      ]);
      const nextCart = cart([line("buy-1", 1)]);
      const dismissed = updateDismissedState(prevCart, nextCart, RULE, {}, now);
      const result = evaluateRule(nextCart, RULE, dismissed, now + 1);
      assert.equal(result.desiredQty, 0);
      assert.equal(result.shouldAdd, false);
    },
  },
  {
    name: "changing qualifying quantity clears same-state dismissal",
    run() {
      const now = 1_000_000;
      const prevCart = cart([
        line("buy-1", 1),
        line("gift-1", 1, { _bxgy: "true", _bxgy_rule_id: "rule-1" }),
      ]);
      const nextCart = cart([line("buy-1", 1)]);
      const dismissed = updateDismissedState(prevCart, nextCart, RULE, {}, now);
      const result = evaluateRule(cart([line("buy-1", 2)]), RULE, dismissed, now + 2);
      assert.equal(result.desiredQty, 2);
      assert.equal(result.shouldAdd, true);
    },
  },
  {
    name: "cart can empty after qualification is removed",
    run() {
      const result = evaluateRule(
        cart([line("gift-1", 1, { _bxgy: "true", _bxgy_rule_id: "rule-1" })]),
        RULE,
      );
      assert.equal(result.buyQty, 0);
      assert.equal(result.desiredQty, 0);
      assert.equal(result.shouldRemove, true);
    },
  },
  {
    name: "manual gift line is never treated like auto-added gift",
    run() {
      const result = evaluateRule(
        cart([
          line("buy-1", 1),
          line("gift-1", 1),
        ]),
        RULE,
      );
      assert.equal(result.manualGift, true);
      assert.equal(result.desiredQty, 0);
      assert.equal(result.shouldAdd, false);
    },
  },
  {
    name: "dismissal expires automatically after ttl",
    run() {
      const now = 1_000_000;
      const prevCart = cart([
        line("buy-1", 1),
        line("gift-1", 1, { _bxgy: "true", _bxgy_rule_id: "rule-1" }),
      ]);
      const nextCart = cart([line("buy-1", 1)]);
      const dismissed = updateDismissedState(prevCart, nextCart, RULE, {}, now);
      const result = evaluateRule(nextCart, RULE, dismissed, now + (31 * 60 * 1000));
      assert.equal(result.desiredQty, 1);
      assert.equal(result.shouldAdd, true);
    },
  },
  {
    name: "single-gift mode caps reward even when multiple qualifying items are present",
    run() {
      const result = evaluateRule(cart([line("buy-1", 3)]), { ...RULE, limitOneGiftPerOrder: true });
      assert.equal(result.desiredQty, 1);
      assert.equal(result.shouldAdd, true);
    },
  },
  {
    name: "default mode still scales gift quantity with qualifying items",
    run() {
      const result = evaluateRule(cart([line("buy-1", 3)]), RULE);
      assert.equal(result.desiredQty, 3);
      assert.equal(result.shouldAdd, true);
    },
  },
];

let failed = false;
console.log("Running BXGY QA checks...\n");

for (const qaCase of cases) {
  try {
    qaCase.run();
    console.log(`PASS ${qaCase.name}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${qaCase.name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

if (failed) {
  process.exitCode = 1;
  console.error("\nBXGY QA checks failed.");
} else {
  console.log("\nAll BXGY QA checks passed.");
}
