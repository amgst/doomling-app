"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Autocomplete,
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  IndexTable,
  InlineGrid,
  InlineStack,
  Select,
  Text,
  TextField,
  Thumbnail,
  Tooltip,
} from "@shopify/polaris";
import OrdersChart from "@/components/charts/OrdersChart";
import RevenueChart from "@/components/charts/RevenueChart";
import FeatureHelpCard from "@/components/dashboard/FeatureHelpCard";
import PolarisProvider from "@/components/PolarisProvider";
import type { GeoCountdownCampaign, GeoCountdownPageTarget } from "@/lib/geoCountdown";
import { safeJson } from "../shared";
import { type Product, PolarisProductAutocomplete, hasMeaningfulVariants, bxgyOptionLabel } from "../products";
import type { BxgyProduct, BxgyRule, BxgySummary, BxgyRuleStat } from "../types/bxgy";

export default function BuyXGetYTabPolaris() {
  const [rules, setRules] = useState<BxgyRule[]>([]);
  const [summary, setSummary] = useState<BxgySummary | null>(null);
  const [ruleStats, setRuleStats] = useState<BxgyRuleStat[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [name, setName] = useState("Cart gift");
  const [buyQuantity, setBuyQuantity] = useState("1");
  const [giftQuantity, setGiftQuantity] = useState("1");
  const [limitOneGiftPerOrder, setLimitOneGiftPerOrder] = useState(false);
  const [message, setMessage] = useState("Free gift added automatically when the rule qualifies.");
  const [priority, setPriority] = useState("1");
  const [autoAdd, setAutoAdd] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [buyProductIds, setBuyProductIds] = useState<string[]>([""]);
  const [buyVariantIds, setBuyVariantIds] = useState<string[]>([""]);
  const [giftProductId, setGiftProductId] = useState("");
  const [giftVariantId, setGiftVariantId] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/standalone/bxgy").then((r) => safeJson(r)),
      fetch("/api/standalone/bxgy-stats").then((r) => safeJson(r)),
      fetch("/api/standalone/products").then((r) => safeJson(r)),
    ])
      .then(([bxgy, bxgyStats, productData]) => {
        setRules(bxgy?.rules ?? []);
        setSummary(bxgyStats?.summary ?? null);
        setRuleStats(bxgyStats?.rules ?? []);
        setProducts(productData?.products ?? []);
      })
      .catch(() => setError("Failed to load Buy X Get Y data."))
      .finally(() => setLoading(false));
  }, []);

  const getSelectedVariantId = (productId: string, variantId?: string) => {
    const product = products.find((entry) => String(entry.id) === productId);
    if (!product?.variants?.length) return "";
    if (!hasMeaningfulVariants(product)) {
      return String(product.variants[0]?.id ?? "");
    }
    if (variantId && product.variants.some((entry) => String(entry.id) === variantId)) {
      return variantId;
    }
    return "";
  };

  const updateBuyProduct = (index: number, productId: string) => {
    setBuyProductIds((current) => current.map((entry, idx) => (idx === index ? productId : entry)));
    setBuyVariantIds((current) =>
      current.map((entry, idx) => (idx === index ? getSelectedVariantId(productId) : entry)),
    );
  };

  const updateBuyVariant = (index: number, variantId: string) => {
    setBuyVariantIds((current) => current.map((entry, idx) => (idx === index ? variantId : entry)));
  };

  const updateGiftProduct = (productId: string) => {
    setGiftProductId(productId);
    setGiftVariantId(getSelectedVariantId(productId));
  };

  const productToBxgy = (productId: string, variantId: string): BxgyProduct | null => {
    const product = products.find((entry) => String(entry.id) === productId);
    const resolvedVariantId = getSelectedVariantId(productId, variantId);
    const variant = product?.variants?.find((entry) => String(entry.id) === resolvedVariantId);
    if (!product || !variant) return null;
    return {
      productId: String(product.id),
      variantId: String(variant.id),
      title: bxgyOptionLabel(product, variant),
      image: product.image?.src ?? "",
      price: variant.price ?? "",
      handle: product.handle,
    };
  };

  const resetForm = () => {
    setEditingId(null);
    setName("Cart gift");
    setBuyQuantity("1");
    setGiftQuantity("1");
    setMessage("Free gift added automatically when the rule qualifies.");
    setLimitOneGiftPerOrder(false);
    setPriority("1");
    setAutoAdd(true);
    setBuyProductIds([""]);
    setBuyVariantIds([""]);
    setGiftProductId("");
    setGiftVariantId("");
  };

  const handleEdit = (rule: BxgyRule) => {
    setEditingId(rule.id);
    setName(rule.name);
    setBuyQuantity(String(rule.buyQuantity));
    setGiftQuantity(String(rule.giftQuantity));
    setLimitOneGiftPerOrder(rule.limitOneGiftPerOrder);
    setMessage(rule.message);
    setPriority(String(rule.priority));
    setAutoAdd(rule.autoAdd);
    setBuyProductIds(rule.buyProducts.map((p) => p.productId));
    setBuyVariantIds(rule.buyProducts.map((p) => p.variantId));
    setGiftProductId(rule.giftProduct?.productId ?? "");
    setGiftVariantId(rule.giftProduct?.variantId ?? "");
    setError(null);
    setSuccessMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleEnabled = async (rule: BxgyRule) => {
    setError(null);
    setSuccessMessage(null);
    setTogglingId(rule.id);
    try {
      const response = await fetch(`/api/standalone/bxgy/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      const data = await safeJson<{ error?: string; warning?: string }>(response);
      if (!response.ok) {
        setError(data?.error ?? "Failed to update rule.");
        return;
      }
      await refreshData();
      if (data?.warning) {
        setError(`Rule updated, but discount sync failed: ${data.warning}`);
      } else {
        setSuccessMessage(rule.enabled ? "Rule paused." : "Rule resumed.");
      }
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setTogglingId(null);
    }
  };

  const refreshData = async () => {
    const [updated, updatedStats] = await Promise.all([
      fetch("/api/standalone/bxgy").then((r) => safeJson(r)).catch(() => null),
      fetch("/api/standalone/bxgy-stats").then((r) => safeJson(r)).catch(() => null),
    ]);
    setRules(updated?.rules ?? []);
    setSummary(updatedStats?.summary ?? null);
    setRuleStats(updatedStats?.rules ?? []);
  };

  const handleSave = async () => {
    const buyProducts = buyProductIds
      .map((productId, index) => productToBxgy(productId, buyVariantIds[index] ?? ""))
      .filter(Boolean) as BxgyProduct[];
    const giftProduct = productToBxgy(giftProductId, giftVariantId);

    if (!name.trim()) {
      setError("Enter a rule name.");
      setSuccessMessage(null);
      return;
    }
    if (buyProducts.length === 0) {
      setError("Select at least one Buy product.");
      setSuccessMessage(null);
      return;
    }
    if (!giftProduct) {
      setError("Select the free Gift product.");
      setSuccessMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/standalone/bxgy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          name,
          buyProducts,
          giftProduct,
          buyQuantity,
          giftQuantity,
          limitOneGiftPerOrder,
          message,
          priority,
          autoAdd,
          enabled: editingId ? (rules.find((r) => r.id === editingId)?.enabled ?? true) : true,
        }),
      });
      const data = await safeJson<{ error?: string; warning?: string; id?: string }>(response);
      if (!response.ok) {
        setError(data?.error ?? "Failed to save BXGY rule.");
        return;
      }

      await refreshData();
      const wasEditing = !!editingId;
      resetForm();

      if (data?.warning) {
        setError(`Rule saved, but discount sync failed: ${data.warning}`);
      } else {
        setSuccessMessage(wasEditing ? "Rule updated." : "Buy X Get Y rule saved.");
      }
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this Buy X Get Y rule? This cannot be undone.")) return;
    setError(null);
    setSuccessMessage(null);
    const response = await fetch(`/api/standalone/bxgy/${id}`, { method: "DELETE" });
    const data = await safeJson<{ error?: string; warning?: string }>(response);
    if (!response.ok) {
      setError(data?.error ?? "Failed to delete BXGY rule.");
      return;
    }
    setRules((prev) => prev.filter((r) => r.id !== id));
    setRuleStats((prev) => prev.filter((s) => s.ruleId !== id));
    if (data?.warning) {
      setError(`Rule deleted, but discount sync failed: ${data.warning}`);
    } else {
      setSuccessMessage("Buy X Get Y rule deleted.");
    }
    refreshData().catch(() => null);
  };

  if (loading) {
    return (
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <div style={{ height: "1rem", width: "35%", background: "#f1f1f1", borderRadius: 4 }} />
            <div style={{ height: "0.75rem", width: "55%", background: "#f8f8f8", borderRadius: 4 }} />
          </BlockStack>
        </Card>
      </BlockStack>
    );
  }

  const selectedGiftProduct = products.find((product) => String(product.id) === giftProductId);
  const selectedTriggerCount = buyProductIds[0] ? 1 : 0;
  const selectedGiftLabel = selectedGiftProduct ? selectedGiftProduct.title : "Choose a gift product";
  const helpBadgeButton: React.CSSProperties = {
    width: 22,
    height: 22,
    borderRadius: 999,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#6b7280",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.76rem",
    fontWeight: 700,
    cursor: "help",
    padding: 0,
  };

  return (
    <BlockStack gap="500">

      {/* Page header */}
      <BlockStack gap="100">
        <Text as="h1" variant="headingXl">Buy X Get Y</Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          Dynamic free-gift rules powered by metaobjects, automatic cart insertion, and dashboard stats.
        </Text>
      </BlockStack>

      {/* Error banner */}
      {error && (
        <Banner tone="critical" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      {successMessage && (
        <Banner tone="success" onDismiss={() => setSuccessMessage(null)}>
          {successMessage}
        </Banner>
      )}

      {/* Summary stat cards */}
      {summary && (
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          {[
            { label: "Active rules", value: summary.activeRules, sub: "Currently compiled" },
            { label: "Qualified carts", value: summary.totalQualified, sub: "Gift unlocked" },
            { label: "Auto-added gifts", value: summary.totalAutoAdded, sub: "Inserted by app" },
            { label: "Conversion", value: summary.conversionRate, sub: "Qualified to added" },
          ].map((card) => (
            <Card key={card.label}>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">{card.label}</Text>
                <Text as="p" variant="headingLg">{String(card.value)}</Text>
                <Text as="p" variant="bodySm" tone="subdued">{card.sub}</Text>
              </BlockStack>
            </Card>
          ))}
        </InlineGrid>
      )}

      {/* Create rule form */}
      <Card>
        <BlockStack gap="500">
          <InlineStack align="space-between" blockAlign="start">
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">{editingId ? "Editing rule" : "New free gift rule"}</Text>
              <Text as="h2" variant="headingLg">{editingId ? "Edit Buy X Get Y rule" : "Launch a Buy X Get Y campaign"}</Text>
            </BlockStack>
            <InlineStack gap="200">
              {editingId && (
                <Button variant="secondary" onClick={resetForm}>Cancel edit</Button>
              )}
              <Badge tone="success">Auto-add gift flow</Badge>
            </InlineStack>
          </InlineStack>

          <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
            {[
              { label: "Main product", value: selectedTriggerCount ? "1 selected" : "Choose product" },
              { label: "Gift product", value: selectedGiftLabel },
              { label: "Rule outcome", value: limitOneGiftPerOrder ? "One free gift max" : `Buy ${buyQuantity || "1"}, get ${giftQuantity || "1"}` },
            ].map((item) => (
              <Card key={item.label}>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">{item.label}</Text>
                  <Text as="p" variant="headingMd">{item.value}</Text>
                </BlockStack>
              </Card>
            ))}
          </InlineGrid>

          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <InlineStack gap="100" blockAlign="center">
                    <Text as="h3" variant="headingMd">Rule setup</Text>
                    <Tooltip content="Basic settings for when the offer should unlock and how the gift should behave.">
                      <button type="button" aria-label="Rule setup help" style={helpBadgeButton}>?</button>
                    </Tooltip>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Set the campaign name, quantities, shopper message, and execution priority.
                  </Text>
                </BlockStack>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <TextField label="Rule name" value={name} onChange={setName} autoComplete="off" helpText="An internal name so you can recognize this offer later." />
                  <TextField label="Priority" type="number" min={1} value={priority} onChange={setPriority} autoComplete="off" helpText="Use a lower number if you want this rule to run before other BXGY rules." />
                </InlineGrid>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <TextField label="Buy quantity" type="number" min={1} value={buyQuantity} onChange={setBuyQuantity} autoComplete="off" helpText="How many main products the shopper must add before the gift is unlocked." />
                  <TextField label="Gift quantity" type="number" min={1} value={giftQuantity} onChange={setGiftQuantity} autoComplete="off" helpText="How many free gift items the shopper receives when the offer unlocks." />
                </InlineGrid>
                <TextField label="Gift message" value={message} onChange={setMessage} autoComplete="off" helpText="Short shopper-facing text for the free gift experience." />
                <Checkbox label="Limit to one gift per cart even if more items qualify" checked={limitOneGiftPerOrder} onChange={setLimitOneGiftPerOrder} helpText="Turn this on if you want the shopper to receive only one gift batch per cart." />
                <Checkbox label="Auto-add gift when the rule qualifies" checked={autoAdd} onChange={setAutoAdd} helpText="Turn this on if you want the app to place the gift into the cart automatically." />
              </BlockStack>
            </Card>

            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="100">
                    <InlineStack gap="100" blockAlign="center">
                      <Text as="h3" variant="headingMd">Gift product</Text>
                      <Tooltip content="This is the free item the shopper receives when the offer unlocks.">
                        <button type="button" aria-label="Gift product help" style={helpBadgeButton}>?</button>
                      </Tooltip>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Choose the exact free gift product and variant to add into the cart when the rule qualifies.
                    </Text>
                  </BlockStack>
                  <PolarisProductAutocomplete
                    products={products}
                    value={giftProductId}
                    onChange={updateGiftProduct}
                    label="Gift product"
                    placeholder="Search free gift product"
                    helpText="This item is the free gift attached to the rule."
                  />
                  {hasMeaningfulVariants(selectedGiftProduct) && (
                    <Select
                      label="Gift variant"
                      options={[
                        { label: "Select variant", value: "" },
                        ...(selectedGiftProduct?.variants?.map((variant) => ({
                          label: variant.title,
                          value: String(variant.id),
                        })) ?? []),
                      ]}
                      value={giftVariantId}
                      onChange={setGiftVariantId}
                    />
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <InlineStack gap="100" blockAlign="center">
                      <Text as="h3" variant="headingMd">Main product</Text>
                      <Tooltip content="This is the product the shopper must buy to unlock the free gift.">
                        <button type="button" aria-label="Main product help" style={helpBadgeButton}>?</button>
                      </Tooltip>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Choose the product that unlocks the free gift when the customer reaches the Buy quantity.
                    </Text>
                  </BlockStack>
                  {(() => {
                    const selectedProduct = products.find((product) => String(product.id) === buyProductIds[0]);
                    const variantOptions = selectedProduct?.variants?.map((variant) => ({
                      label: variant.title,
                      value: String(variant.id),
                    })) ?? [];
                    return (
                      <InlineStack gap="200" blockAlign="end">
                        <div style={{ flex: 1 }}>
                          <PolarisProductAutocomplete
                            products={products}
                            value={buyProductIds[0] ?? ""}
                            onChange={(value) => updateBuyProduct(0, value)}
                            label="Main product"
                            placeholder="Search main product"
                            helpText="This is the product the shopper must add to unlock the free gift."
                          />
                        </div>
                        {hasMeaningfulVariants(selectedProduct) && (
                          <div style={{ minWidth: 220 }}>
                            <Select
                              label="Variant"
                              options={[{ label: "Select variant", value: "" }, ...variantOptions]}
                              value={buyVariantIds[0] ?? ""}
                              onChange={(value) => updateBuyVariant(0, value)}
                            />
                          </div>
                        )}
                      </InlineStack>
                    );
                  })()}
                </BlockStack>
              </Card>
            </BlockStack>
          </InlineGrid>

          <InlineStack align="end">
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editingId ? "Update rule" : "Save BXGY rule"}
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>

      {/* Rules list */}
      <Card padding="0">
        {rules.length === 0 ? (
          <EmptyState heading="No Buy X Get Y rules yet" image="">
            <Text as="p" variant="bodyMd" tone="subdued">
              Create your first rule above to automatically add free gifts to qualifying carts.
            </Text>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: "rule", plural: "rules" }}
            itemCount={rules.length}
            headings={[
              { title: "Rule" },
              { title: "Buy products" },
              { title: "Gift" },
              { title: "Quantities" },
              { title: "Priority" },
              { title: "Status" },
              { title: "" },
            ]}
            selectable={false}
          >
            {rules.map((rule, index) => (
              <IndexTable.Row id={rule.id} key={rule.id} position={index}>
                <IndexTable.Cell>
                  <BlockStack gap="050">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">{rule.name}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">{rule.message}</Text>
                  </BlockStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="p" variant="bodySm">{rule.buyProducts.map((p) => p.title).join(", ")}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack gap="200" blockAlign="center">
                    {rule.giftProduct?.image && (
                      <Thumbnail source={rule.giftProduct.image} alt={rule.giftProduct.title ?? ""} size="small" />
                    )}
                    <BlockStack gap="050">
                      <Text as="p" variant="bodySm" fontWeight="semibold">{rule.giftProduct?.title ?? "—"}</Text>
                      <Badge tone="success">Free gift</Badge>
                    </BlockStack>
                  </InlineStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="p" variant="bodySm">{rule.limitOneGiftPerOrder ? `Buy ${rule.buyQuantity}, get ${rule.giftQuantity} once per cart` : `Buy ${rule.buyQuantity}, get ${rule.giftQuantity}`}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge>{String(rule.priority)}</Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone={rule.enabled ? "success" : "warning"}>{rule.enabled ? "Active" : "Paused"}</Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack gap="200">
                    <Button size="slim" onClick={() => handleEdit(rule)}>Edit</Button>
                    <Button size="slim" loading={togglingId === rule.id} disabled={togglingId === rule.id} onClick={() => void handleToggleEnabled(rule)}>
                      {rule.enabled ? "Pause" : "Resume"}
                    </Button>
                    <Button tone="critical" variant="secondary" size="slim" onClick={() => handleDelete(rule.id)}>
                      Delete
                    </Button>
                  </InlineStack>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        )}
      </Card>

      {/* Performance stats */}
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">BXGY performance</Text>
          {ruleStats.length === 0 ? (
            <Text as="p" variant="bodyMd" tone="subdued">
              Statistics will appear once carts qualify and gifts are auto-added.
            </Text>
          ) : (
            <DataTable
              columnContentTypes={["text", "text", "text", "numeric", "numeric", "text"]}
              headings={["Rule", "Buy", "Gift", "Qualified", "Added", "Conversion"]}
              rows={ruleStats.map((stat) => [
                stat.name,
                stat.buyLabel,
                stat.giftLabel,
                stat.qualified,
                stat.autoAdded,
                <Badge key={stat.ruleId} tone="success">{stat.conversionRate}</Badge>,
              ])}
            />
          )}
        </BlockStack>
      </Card>

      <FeatureHelpCard
        intro="You can browse our app guide to understand this section, read common questions, and get simple setup help whenever you need it."
        sections={[
          {
            title: "Getting started",
            body: [
              "Choose a main product, choose a gift product, then decide how many of the main product the shopper must buy before the gift is unlocked.",
              "Once the shopper qualifies, the app can automatically place the free gift into the cart for them.",
            ],
          },
          {
            title: "Field guide",
            body: [
              "Main product is the product the shopper must buy to unlock the offer. Buy quantity is how many they must add before the gift is unlocked.",
              "Gift product is the free item the shopper receives. Gift quantity is how many free gift items they receive when the offer is unlocked.",
              "Turn on the gift limit option if you want the shopper to receive the gift only once, even if they add more qualifying items.",
            ],
          },
          {
            title: "Examples",
            body: [
              "Buy 1, get 1 means the shopper adds 1 main product and receives 1 free gift.",
              "Buy 3, get 3 means the shopper must add 3 of the main product, then receives 3 free gifts.",
              "If you want only one batch of gifts per cart, turn on the limit option.",
            ],
          },
          {
            title: "Common questions",
            body: [
              "In most cases the main product and gift product should be different products.",
              "After saving a rule, test it once on the storefront to make sure the cart behaves the way you expect.",
            ],
          },
        ]}
      />

    </BlockStack>
  );
}
