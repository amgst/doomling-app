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

export default function BundleOffersTab() {
  const [offers, setOffers] = useState<BundleOffer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("Ultimate Bundle");
  const [productId, setProductId] = useState("");
  const [code, setCode] = useState("ULTIMATE");
  const [compareAtPrice, setCompareAtPrice] = useState("95.00");
  const [discountedPrice, setDiscountedPrice] = useState("59.99");
  const [enabled, setEnabled] = useState(true);

  const loadData = useCallback(async () => {
    const [bundleData, productData] = await Promise.all([
      fetch("/api/standalone/bundles").then((r) => safeJson<{ offers?: BundleOffer[]; error?: string }>(r)),
      fetch("/api/standalone/products").then((r) => safeJson<{ products?: Product[]; error?: string }>(r)),
    ]);

    setOffers(bundleData?.offers ?? []);
    setProducts(productData?.products ?? []);
  }, []);

  useEffect(() => {
    loadData()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load bundle offers."))
      .finally(() => setLoading(false));
  }, [loadData]);

  const resetForm = () => {
    setEditingId(null);
    setName("Ultimate Bundle");
    setProductId("");
    setCode("ULTIMATE");
    setCompareAtPrice("95.00");
    setDiscountedPrice("59.99");
    setEnabled(true);
  };

  const selectedProduct = products.find((product) => String(product.id) === productId) ?? null;
  const usedProductIds = new Set(offers.filter((offer) => offer.id !== editingId).map((offer) => String(offer.productId)));
  const selectableProducts = products.filter((product) => !usedProductIds.has(String(product.id)));
  const totalSavings = offers.reduce((sum, offer) => {
    const comparePrice = Number(offer.compareAtPrice);
    const salePrice = Number(offer.discountedPrice);
    return sum + Math.max(comparePrice - salePrice, 0);
  }, 0);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Enter an internal offer name.");
      return;
    }
    if (!productId) {
      setError("Choose the bundle product to control.");
      return;
    }
    if (!code.trim()) {
      setError("Enter the public discount code name.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/standalone/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name,
          productId,
          productTitle: selectedProduct?.title ?? "",
          code,
          compareAtPrice,
          discountedPrice,
          enabled,
        }),
      });
      const data = await safeJson<{ offers?: BundleOffer[]; warning?: string; error?: string }>(response);
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      setOffers(data?.offers ?? []);
      if (data?.warning) {
        setError(data.warning);
      } else {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save bundle offer.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (offerId: string) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/standalone/bundles/${offerId}`, { method: "DELETE" });
      const data = await safeJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      setOffers((current) => current.filter((offer) => offer.id !== offerId));
      if (editingId === offerId) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete bundle offer.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (offer: BundleOffer) => {
    setEditingId(offer.id);
    setName(offer.name);
    setProductId(offer.productId);
    setCode(offer.code);
    setCompareAtPrice(offer.compareAtPrice);
    setDiscountedPrice(offer.discountedPrice);
    setEnabled(offer.enabled);
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading bundle offers...</div>;
  }

  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Bundle Offers</h1>
        <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.84rem", maxWidth: 820 }}>
          Pick specific bundle products, give each one a named native Shopify discount code, and let the storefront app embed show the sale price preview while cart and checkout use a real discount code instead of a manually lowered product price.
        </p>
      </div>

      {error && (
        <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", color: "#c0392b", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        {[
          { label: "Bundle offers", value: offers.length, sub: "Products with managed bundle pricing" },
          { label: "Active now", value: offers.filter((offer) => offer.enabled).length, sub: `${offers.filter((offer) => !offer.enabled).length} paused` },
          { label: "Tracked savings", value: fmt(totalSavings, "USD"), sub: "Difference between compare-at and sale price" },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.85rem 0.95rem" }}>
            <p style={{ margin: 0, fontSize: "0.73rem", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{card.label}</p>
            <p style={{ margin: "0.24rem 0 0.12rem", fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>{card.value}</p>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280" }}>{card.sub}</p>
          </div>
        ))}
      </div>

      <Card>
        <BlockStack gap="400">
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <TextField label="Offer name" value={name} onChange={setName} autoComplete="off" helpText="Internal admin label for your team." />
            <TextField label="Public discount code" value={code} onChange={(value) => setCode(value.toUpperCase())} autoComplete="off" helpText="Shown in cart and checkout, for example ULTIMATE." />
            <PolarisProductAutocomplete
              products={editingId ? products : selectableProducts}
              value={productId}
              onChange={setProductId}
              label="Bundle product"
              placeholder="Search bundle product"
              helpText="Choose the storefront bundle product that should receive this managed discount."
            />
            <div style={{ display: "flex", alignItems: "end" }}>
              <Checkbox label="Offer is active" checked={enabled} onChange={setEnabled} />
            </div>
            <TextField label="Compare-at / value price" type="number" min={0} step={0.01} value={compareAtPrice} onChange={setCompareAtPrice} autoComplete="off" />
            <TextField label="Discounted storefront price" type="number" min={0} step={0.01} value={discountedPrice} onChange={setDiscountedPrice} autoComplete="off" />
          </InlineGrid>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" tone="subdued">
              Enable the `Bundle offers` app embed in your theme so homepage, collection, and product pages show the sale preview and the matching code is applied automatically in cart.
            </Text>
            <InlineStack gap="300">
              {editingId && (
                <Button onClick={resetForm} disabled={saving}>
                  Cancel
                </Button>
              )}
              <Button variant="primary" onClick={handleSave} loading={saving}>
                {editingId ? "Update offer" : "Create offer"}
              </Button>
            </InlineStack>
          </InlineStack>
        </BlockStack>
      </Card>

      <div style={{ marginTop: "1rem", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.1rem", borderBottom: "1px solid #e5e7eb" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Configured bundle offers</p>
        </div>
        {offers.length === 0 ? (
          <p style={{ margin: 0, padding: "1.5rem", color: "#6b7280" }}>
            No bundle offers yet. Create the first one above, then enable the Bundle Offers app embed in the theme customizer.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Offer</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Product</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Code</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Storefront price</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Status</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "right", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer, index) => (
                <tr key={offer.id} style={{ borderBottom: index < offers.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#111827" }}>{offer.name}</div>
                    <div style={{ fontSize: "0.76rem", color: "#6b7280", marginTop: "0.15rem" }}>Discount ID: {offer.discountId ?? "Pending sync"}</div>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.82rem", color: "#374151" }}>{offer.productTitle}</td>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
                    <span style={{ display: "inline-flex", padding: "0.22rem 0.55rem", borderRadius: "999px", background: "#eef2ff", color: "#4338ca", fontSize: "0.76rem", fontWeight: 700 }}>
                      {offer.code}
                    </span>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.82rem", color: "#374151" }}>
                    <span style={{ fontWeight: 700, color: "#111827" }}>{fmt(Number(offer.discountedPrice), "USD")}</span>
                    <span style={{ marginLeft: "0.45rem", textDecoration: "line-through", color: "#6b7280" }}>{fmt(Number(offer.compareAtPrice), "USD")}</span>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
                    <span style={{ display: "inline-flex", padding: "0.25rem 0.55rem", borderRadius: "999px", background: offer.enabled ? "#ecfdf5" : "#f3f4f6", color: offer.enabled ? "#166534" : "#6b7280", fontSize: "0.76rem", fontWeight: 700 }}>
                      {offer.enabled ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", textAlign: "right" }}>
                    <InlineStack gap="200" align="end">
                      <Button size="micro" onClick={() => startEdit(offer)}>Edit</Button>
                      <Button size="micro" tone="critical" variant="tertiary" onClick={() => void handleDelete(offer.id)} loading={saving}>
                        Delete
                      </Button>
                    </InlineStack>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
