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
} from "@shopify/polaris";
import OrdersChart from "@/components/charts/OrdersChart";
import RevenueChart from "@/components/charts/RevenueChart";
import PolarisProvider from "@/components/PolarisProvider";
import type { GeoCountdownCampaign, GeoCountdownPageTarget } from "@/lib/geoCountdown";
import {
  type Stats,
  type Product,
  type CartQuantityRule,
  type UpsellRule,
  type UpsellProduct,
  type BxgyProduct,
  type BxgyRule,
  type BxgySummary,
  type BxgyRuleStat,
  type ThemeSummary,
  type LaunchpadSchedule,
  type BundleOffer,
  type PostPurchaseProduct,
  type PostPurchaseOffer,
  type PostPurchaseSummary,
  type PostPurchaseOfferStat,
  type RuleStat,
  RANGES,
  fmt,
  calcTrend,
  safeJson,
  SearchableProductSelect,
  PolarisProductAutocomplete,
  SkeletonCard,
  StatCard,
  AppHealthCheck,
  ModuleOverviewStrip,
  BxgyOverviewStrip,
  hasMeaningfulVariants,
  bxgyOptionLabel,
} from "../shared";

export default function BuyXGetYTabPolaris() {
  const [rules, setRules] = useState<BxgyRule[]>([]);
  const [summary, setSummary] = useState<BxgySummary | null>(null);
  const [ruleStats, setRuleStats] = useState<BxgyRuleStat[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Cart gift");
  const [buyQuantity, setBuyQuantity] = useState("1");
  const [giftQuantity, setGiftQuantity] = useState("1");
  const [message, setMessage] = useState("Free gift added automatically when the rule qualifies.");
  const [priority, setPriority] = useState("1");
  const [autoAdd, setAutoAdd] = useState(true);
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

  const addBuyTrigger = () => {
    if (buyProductIds.length >= 6) return;
    setBuyProductIds((current) => [...current, ""]);
    setBuyVariantIds((current) => [...current, ""]);
  };

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

  const removeBuyTrigger = (index: number) => {
    setBuyProductIds((current) => current.filter((_, idx) => idx !== index));
    setBuyVariantIds((current) => current.filter((_, idx) => idx !== index));
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
    setName("Cart gift");
    setBuyQuantity("1");
    setGiftQuantity("1");
    setMessage("Free gift added automatically when the rule qualifies.");
    setPriority("1");
    setAutoAdd(true);
    setBuyProductIds([""]);
    setBuyVariantIds([""]);
    setGiftProductId("");
    setGiftVariantId("");
  };

  const refreshData = async () => {
    const [updated, updatedStats] = await Promise.all([
      fetch("/api/standalone/bxgy").then((r) => safeJson(r)),
      fetch("/api/standalone/bxgy-stats").then((r) => safeJson(r)),
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
      return;
    }
    if (buyProducts.length === 0) {
      setError("Select at least one Buy product.");
      return;
    }
    if (!giftProduct) {
      setError("Select the free Gift product.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/standalone/bxgy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        buyProducts,
        giftProduct,
        buyQuantity,
        giftQuantity,
        message,
        priority,
        autoAdd,
        enabled: true,
      }),
    });
    const data = await safeJson<{ error?: string; warning?: string }>(response);
    if (!response.ok) {
      setError(data?.error ?? "Failed to save BXGY rule.");
      setSaving(false);
      return;
    }
    if (data?.warning) {
      setError(data.warning);
    }

    await refreshData();
    resetForm();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/standalone/bxgy/${id}`, { method: "DELETE" });
    const data = await safeJson<{ error?: string; warning?: string }>(response);
    if (!response.ok) {
      setError(data?.error ?? "Failed to delete BXGY rule.");
      return;
    }
    if (data?.warning) {
      setError(data.warning);
    }
    await refreshData();
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
  const selectedTriggerCount = buyProductIds.filter(Boolean).length;
  const selectedGiftLabel = selectedGiftProduct ? selectedGiftProduct.title : "Choose a gift product";

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
              <Text as="p" variant="bodySm" tone="subdued">New free gift rule</Text>
              <Text as="h2" variant="headingLg">Launch a Buy X Get Y campaign</Text>
            </BlockStack>
            <Badge tone="success">Auto-add gift flow</Badge>
          </InlineStack>

          <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
            {[
              { label: "Buy triggers", value: `${selectedTriggerCount || 0} selected` },
              { label: "Gift product", value: selectedGiftLabel },
              { label: "Rule outcome", value: `Buy ${buyQuantity || "1"}, get ${giftQuantity || "1"}` },
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
                  <Text as="h3" variant="headingMd">Rule setup</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Set the campaign name, quantities, shopper message, and execution priority.
                  </Text>
                </BlockStack>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <TextField label="Rule name" value={name} onChange={setName} autoComplete="off" />
                  <TextField label="Priority" type="number" min={1} value={priority} onChange={setPriority} autoComplete="off" />
                </InlineGrid>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <TextField label="Buy quantity" type="number" min={1} value={buyQuantity} onChange={setBuyQuantity} autoComplete="off" />
                  <TextField label="Gift quantity" type="number" min={1} value={giftQuantity} onChange={setGiftQuantity} autoComplete="off" />
                </InlineGrid>
                <TextField label="Gift message" value={message} onChange={setMessage} autoComplete="off" />
                <Checkbox label="Auto-add gift when the rule qualifies" checked={autoAdd} onChange={setAutoAdd} />
              </BlockStack>
            </Card>

            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingMd">Gift product</Text>
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
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingMd">Qualifying products</Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Add one or more products that should count toward the Buy quantity.
                      </Text>
                    </BlockStack>
                    <Button onClick={addBuyTrigger} disabled={buyProductIds.length >= 6}>Add trigger</Button>
                  </InlineStack>
                  {buyProductIds.map((productId, index) => {
                    const selectedProduct = products.find((product) => String(product.id) === productId);
                    const variantOptions = selectedProduct?.variants?.map((variant) => ({
                      label: variant.title,
                      value: String(variant.id),
                    })) ?? [];
                    return (
                      <InlineStack key={index} gap="200" blockAlign="end">
                        <div style={{ flex: 1 }}>
                          <PolarisProductAutocomplete
                            products={products}
                            value={productId}
                            onChange={(value) => updateBuyProduct(index, value)}
                            label={`Buy product ${index + 1}`}
                            placeholder="Search trigger product"
                          />
                        </div>
                        {hasMeaningfulVariants(selectedProduct) && (
                          <div style={{ minWidth: 220 }}>
                            <Select
                              label="Variant"
                              options={[{ label: "Select variant", value: "" }, ...variantOptions]}
                              value={buyVariantIds[index] ?? ""}
                              onChange={(value) => updateBuyVariant(index, value)}
                            />
                          </div>
                        )}
                        {buyProductIds.length > 1 && (
                          <Button tone="critical" variant="secondary" onClick={() => removeBuyTrigger(index)}>
                            Remove
                          </Button>
                        )}
                      </InlineStack>
                    );
                  })}
                </BlockStack>
              </Card>
            </BlockStack>
          </InlineGrid>

          <InlineStack align="end">
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save BXGY rule
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
                  <Text as="p" variant="bodySm">Buy {rule.buyQuantity}, get {rule.giftQuantity}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge>{String(rule.priority)}</Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Button tone="critical" variant="secondary" size="slim" onClick={() => handleDelete(rule.id)}>
                    Delete
                  </Button>
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

    </BlockStack>
  );
}
