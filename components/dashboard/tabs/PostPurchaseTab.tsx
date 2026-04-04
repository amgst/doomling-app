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

export default function PostPurchaseTab() {
  const [offers, setOffers] = useState<PostPurchaseOffer[]>([]);
  const [summary, setSummary] = useState<PostPurchaseSummary | null>(null);
  const [offerStats, setOfferStats] = useState<PostPurchaseOfferStat[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Post-purchase offer");
  const [headline, setHeadline] = useState("One more thing before you go");
  const [body, setBody] = useState("Add this bonus item to the order you just placed without starting checkout again.");
  const [ctaLabel, setCtaLabel] = useState("Add to my order");
  const [discountPercent, setDiscountPercent] = useState("15");
  const [priority, setPriority] = useState("1");
  const [triggerType, setTriggerType] = useState<PostPurchaseOffer["triggerType"]>("all_orders");
  const [triggerProductIds, setTriggerProductIds] = useState<string[]>([""]);
  const [minimumSubtotal, setMinimumSubtotal] = useState("0");
  const [offerProductId, setOfferProductId] = useState("");
  const [offerVariantId, setOfferVariantId] = useState("");
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/standalone/post-purchase").then((r) => safeJson(r)),
      fetch("/api/standalone/post-purchase-stats").then((r) => safeJson(r)),
      fetch("/api/standalone/products").then((r) => safeJson(r)),
    ])
      .then(([offerData, statsData, productData]) => {
        setOffers(offerData?.offers ?? []);
        setSummary(statsData?.summary ?? null);
        setOfferStats(statsData?.offers ?? []);
        setProducts(productData?.products ?? []);
      })
      .catch(() => setError("Failed to load post-purchase offers."))
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

  const updateOfferProduct = (productId: string) => {
    setOfferProductId(productId);
    setOfferVariantId(getSelectedVariantId(productId));
  };

  const updateTriggerProduct = (index: number, productId: string) => {
    setTriggerProductIds((current) => current.map((entry, idx) => (idx === index ? productId : entry)));
  };

  const addTriggerProduct = () => {
    if (triggerProductIds.length >= 6) return;
    setTriggerProductIds((current) => [...current, ""]);
  };

  const removeTriggerProduct = (index: number) => {
    setTriggerProductIds((current) => current.filter((_, idx) => idx !== index));
  };

  const productToOffer = (productId: string, variantId: string): PostPurchaseProduct | null => {
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

  const refreshData = async () => {
    const [offerData, statsData] = await Promise.all([
      fetch("/api/standalone/post-purchase").then((r) => safeJson(r)),
      fetch("/api/standalone/post-purchase-stats").then((r) => safeJson(r)),
    ]);
    setOffers(offerData?.offers ?? []);
    setSummary(statsData?.summary ?? null);
    setOfferStats(statsData?.offers ?? []);
  };

  const resetForm = () => {
    setEditingOfferId(null);
    setName("Post-purchase offer");
    setHeadline("One more thing before you go");
    setBody("Add this bonus item to the order you just placed without starting checkout again.");
    setCtaLabel("Add to my order");
    setDiscountPercent("15");
    setPriority("1");
    setTriggerType("all_orders");
    setTriggerProductIds([""]);
    setMinimumSubtotal("0");
    setOfferProductId("");
    setOfferVariantId("");
  };

  const startEditing = (offer: PostPurchaseOffer) => {
    setEditingOfferId(offer.id);
    setName(offer.name);
    setHeadline(offer.headline || "One more thing before you go");
    setBody(offer.body || "Add this bonus item to the order you just placed without starting checkout again.");
    setCtaLabel(offer.ctaLabel || "Add to my order");
    setDiscountPercent(String(offer.discountPercent || 15));
    setPriority(String(offer.priority || 1));
    setTriggerType(offer.triggerType || "all_orders");
    setTriggerProductIds(offer.triggerProductIds.length ? offer.triggerProductIds : [""]);
    setMinimumSubtotal(String(offer.minimumSubtotal || 0));
    setOfferProductId(offer.offerProduct?.productId ?? "");
    setOfferVariantId(offer.offerProduct?.variantId ?? "");
    setError(null);
  };

  const handleSave = async () => {
    const offerProduct = productToOffer(offerProductId, offerVariantId);
    const sanitizedTriggerProductIds = triggerProductIds.filter(Boolean);

    if (!name.trim()) {
      setError("Enter an offer name.");
      return;
    }
    if (!offerProduct) {
      setError("Select the product to offer after checkout.");
      return;
    }
    if (triggerType === "contains_product" && sanitizedTriggerProductIds.length === 0) {
      setError("Choose at least one trigger product for contains-product targeting.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/standalone/post-purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingOfferId,
        name,
        offerProduct,
        headline,
        body,
        ctaLabel,
        discountPercent,
        priority,
        triggerType,
        triggerProductIds: sanitizedTriggerProductIds,
        minimumSubtotal,
        enabled: true,
      }),
    });
    const data = await safeJson<{ error?: string }>(response);
    if (!response.ok) {
      setError(data?.error ?? "Failed to save post-purchase offer.");
      setSaving(false);
      return;
    }

    await refreshData();
    resetForm();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/standalone/post-purchase/${id}`, { method: "DELETE" });
    const data = await safeJson<{ error?: string }>(response);
    if (!response.ok) {
      setError(data?.error ?? "Failed to delete post-purchase offer.");
      return;
    }
    await refreshData();
  };

  if (loading) {
    return (
      <PolarisProvider>
        <div style={{ padding: "2rem 0" }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
              <Text as="p" tone="subdued">Loading...</Text>
            </div>
          </Card>
        </div>
      </PolarisProvider>
    );
  }

  const selectedOfferProduct = products.find((product) => String(product.id) === offerProductId);
  const selectedProductLabel = selectedOfferProduct ? selectedOfferProduct.title : "Choose an offer product";
  const selectedTriggerCount = triggerProductIds.filter(Boolean).length;
  const triggerSummaryLabel =
    triggerType === "all_orders"
      ? "All eligible orders"
      : triggerType === "minimum_subtotal"
        ? `Subtotal over ${minimumSubtotal || "0"}`
        : `${selectedTriggerCount || 0} trigger product${selectedTriggerCount === 1 ? "" : "s"}`;
  const triggerOptions = [
    { label: "Every eligible order can see it", value: "all_orders" },
    { label: "Order subtotal reaches a threshold", value: "minimum_subtotal" },
    { label: "The order contains selected products", value: "contains_product" },
  ];
  const variantOptions = selectedOfferProduct?.variants?.map((variant) => ({
    label: variant.title,
    value: String(variant.id),
  })) ?? [];

  return (
    <PolarisProvider>
      <>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Post-Purchase</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>
            Build one-click offers for the moment right after checkout, with targeting, discounting, and offer stats in one place.
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: "1rem" }}>
            <Card>
              <Text as="p" tone="critical">{error}</Text>
            </Card>
          </div>
        )}

        <div style={{ marginBottom: "1.5rem" }}>
          <Card>
            <BlockStack gap="500">
              <InlineStack align="space-between" blockAlign="start">
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    {editingOfferId ? "Editing post-purchase offer" : "New post-purchase offer"}
                  </Text>
                  <Text as="h2" variant="headingLg">
                    {editingOfferId ? "Update the selected checkout offer" : "Launch a one-click offer after checkout"}
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Rebuy-style flow for the order-complete moment: choose the product, set the offer copy, and decide whether it appears for all orders, qualifying carts, or orders above a threshold.
                  </Text>
                </BlockStack>
                <Badge tone="info">Checkout upsell layer</Badge>
              </InlineStack>

              <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
                {[
                  { label: "Discount", value: `${discountPercent || "0"}% off` },
                  { label: "Trigger", value: triggerSummaryLabel },
                  { label: "Offer product", value: selectedProductLabel },
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
                      <Text as="h3" variant="headingMd">Offer content</Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Set the internal name, shopper-facing copy, and the action text shown after checkout.
                      </Text>
                    </BlockStack>
                    <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                      <TextField label="Offer name" value={name} onChange={setName} autoComplete="off" />
                      <TextField label="CTA label" value={ctaLabel} onChange={setCtaLabel} autoComplete="off" />
                    </InlineGrid>
                    <TextField label="Headline" value={headline} onChange={setHeadline} autoComplete="off" />
                    <TextField label="Offer body" value={body} onChange={setBody} multiline={6} autoComplete="off" />
                  </BlockStack>
                </Card>

                <BlockStack gap="400">
                  <Card>
                    <BlockStack gap="400">
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingMd">Offer product</Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Choose the item to show immediately after checkout. If the product has variants, select the exact one to sell.
                        </Text>
                      </BlockStack>
                      <PolarisProductAutocomplete
                        products={products}
                        value={offerProductId}
                        onChange={updateOfferProduct}
                        label="Offer product"
                        placeholder="Search product to offer"
                        helpText="This is the item the customer can add after completing checkout."
                      />
                      {hasMeaningfulVariants(selectedOfferProduct) && (
                        <Select label="Variant" options={variantOptions} value={offerVariantId} onChange={setOfferVariantId} />
                      )}
                    </BlockStack>
                  </Card>

                  <Card>
                    <BlockStack gap="400">
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingMd">Rules and priority</Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Control discount strength, sequencing, and which checkout completions qualify for this offer.
                        </Text>
                      </BlockStack>
                      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                        <TextField label="Discount percent" type="number" min={1} max={100} value={discountPercent} onChange={setDiscountPercent} autoComplete="off" />
                        <TextField label="Priority" type="number" min={1} value={priority} onChange={setPriority} autoComplete="off" />
                      </InlineGrid>
                      <Select label="Show offer when" options={triggerOptions} value={triggerType} onChange={(value) => setTriggerType(value as PostPurchaseOffer["triggerType"])} />
                      {triggerType === "minimum_subtotal" && (
                        <TextField label="Minimum subtotal" type="number" min={0} step={0.01} value={minimumSubtotal} onChange={setMinimumSubtotal} autoComplete="off" />
                      )}
                      {triggerType === "contains_product" && (
                        <BlockStack gap="300">
                          <InlineStack align="space-between" blockAlign="center">
                            <Text as="p" variant="bodyMd">Qualifying products</Text>
                            <Button onClick={addTriggerProduct}>Add product</Button>
                          </InlineStack>
                          {triggerProductIds.map((productId, index) => (
                            <InlineStack key={index} gap="200" blockAlign="end">
                              <div style={{ flex: 1 }}>
                                <PolarisProductAutocomplete
                                  products={products}
                                  value={productId}
                                  onChange={(value) => updateTriggerProduct(index, value)}
                                  label={`Qualifying product ${index + 1}`}
                                  placeholder="Search qualifying product"
                                />
                              </div>
                              {triggerProductIds.length > 1 && (
                                <Button tone="critical" variant="secondary" onClick={() => removeTriggerProduct(index)}>
                                  Remove
                                </Button>
                              )}
                            </InlineStack>
                          ))}
                        </BlockStack>
                      )}
                    </BlockStack>
                  </Card>
                </BlockStack>
              </InlineGrid>

              <InlineStack align="end" gap="300">
                {editingOfferId && <Button onClick={resetForm}>Cancel</Button>}
                <Button variant="primary" onClick={handleSave} loading={saving}>
                  {editingOfferId ? "Update post-purchase offer" : "Save post-purchase offer"}
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </div>

        {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            {[
              { label: "Active offers", value: summary.activeOffers, sub: "Available in the current setup" },
              { label: "Offer views", value: summary.totalViews, sub: "Rendered after checkout" },
              { label: "Accepted", value: summary.totalAccepted, sub: "Customers who took the offer" },
              { label: "Conversion", value: summary.conversionRate, sub: "Views to accepted" },
              { label: "Revenue", value: fmt(summary.totalRevenue, "USD"), sub: "Tracked post-purchase sales" },
            ].map((card) => (
              <div key={card.label} style={{ background: "#fff", borderRadius: "12px", padding: "1rem 1.15rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <p style={{ margin: 0, fontSize: "0.74rem", color: "#6d7175", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{card.label}</p>
                <p style={{ margin: "0.35rem 0 0.15rem", fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>{card.value}</p>
                <p style={{ margin: 0, fontSize: "0.76rem", color: "#6d7175" }}>{card.sub}</p>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: "1.5rem" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e5e7eb" }}>
            <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Configured offers</p>
          </div>
          {offers.length === 0 ? (
            <p style={{ margin: 0, padding: "2rem", textAlign: "center", color: "#6b7280" }}>
              No post-purchase offers yet. Create your first offer above.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  {["Offer", "Product", "Trigger", "Discount", "Priority", "", ""].map((heading) => (
                    <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.78rem", fontWeight: 700, color: "#6d7175", textTransform: "uppercase" }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {offers.map((offer, index) => (
                  <tr key={offer.id} style={{ borderBottom: index < offers.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <td style={{ padding: "0.95rem 1rem", verticalAlign: "top" }}>
                      <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>{offer.name}</p>
                      <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "#6b7280", maxWidth: 280 }}>{offer.headline || offer.body}</p>
                    </td>
                    <td style={{ padding: "0.95rem 1rem", fontSize: "0.86rem", color: "#111827" }}>{offer.offerProduct?.title ?? "-"}</td>
                    <td style={{ padding: "0.95rem 1rem", fontSize: "0.84rem", color: "#111827" }}>
                      {offer.triggerType === "all_orders" && "All eligible orders"}
                      {offer.triggerType === "minimum_subtotal" && `Subtotal at least ${fmt(offer.minimumSubtotal, "USD")}`}
                      {offer.triggerType === "contains_product" && `${offer.triggerProductIds.length} qualifying product${offer.triggerProductIds.length !== 1 ? "s" : ""}`}
                    </td>
                    <td style={{ padding: "0.95rem 1rem", fontSize: "0.84rem", color: "#111827" }}>{offer.discountPercent}% off</td>
                    <td style={{ padding: "0.95rem 1rem" }}>
                      <span style={{ display: "inline-flex", padding: "0.25rem 0.55rem", borderRadius: "999px", background: "#eff6ff", color: "#1d4ed8", fontSize: "0.78rem", fontWeight: 700 }}>
                        {offer.priority}
                      </span>
                    </td>
                    <td style={{ padding: "0.95rem 1rem", textAlign: "right" }}>
                      <button onClick={() => startEditing(offer)} style={{ padding: "0.45rem 0.8rem", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: "8px", fontSize: "0.8rem", cursor: "pointer" }}>
                        Edit
                      </button>
                    </td>
                    <td style={{ padding: "0.95rem 1rem", textAlign: "right" }}>
                      <button onClick={() => handleDelete(offer.id)} style={{ padding: "0.45rem 0.8rem", background: "#fff", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "0.8rem", cursor: "pointer" }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e5e7eb" }}>
            <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Post-purchase performance</p>
          </div>
          {offerStats.length === 0 ? (
            <p style={{ margin: 0, padding: "2rem", textAlign: "center", color: "#6b7280" }}>
              Stats will appear once the checkout extension starts rendering offers and customers accept them.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  {["Offer", "Product", "Views", "Accepted", "Conversion", "Revenue"].map((heading) => (
                    <th key={heading} style={{ padding: "0.8rem 1rem", textAlign: "left", fontSize: "0.78rem", fontWeight: 700, color: "#6d7175", textTransform: "uppercase" }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {offerStats.map((stat, index) => (
                  <tr key={stat.offerId} style={{ borderBottom: index < offerStats.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "#111827" }}>{stat.name}</td>
                    <td style={{ padding: "0.85rem 1rem", color: "#374151", fontSize: "0.85rem" }}>{stat.productLabel}</td>
                    <td style={{ padding: "0.85rem 1rem", color: "#111827" }}>{stat.viewed}</td>
                    <td style={{ padding: "0.85rem 1rem", color: "#111827" }}>{stat.accepted}</td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <span style={{ display: "inline-flex", padding: "0.25rem 0.55rem", borderRadius: "999px", background: "#ecfdf5", color: "#166534", fontSize: "0.78rem", fontWeight: 700 }}>
                        {stat.conversionRate}
                      </span>
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: "#111827" }}>{fmt(stat.revenue, "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </>
    </PolarisProvider>
  );
}
