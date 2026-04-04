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

export default function CartLimitsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [rules, setRules] = useState<CartQuantityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState("1");

  useEffect(() => {
    Promise.all([
      fetch("/api/standalone/products").then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/";
          throw new Error("unauth");
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
        return data.products ?? [];
      }),
      fetch("/api/standalone/cart-limits").then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/";
          throw new Error("unauth");
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
        return data.rules ?? [];
      }),
    ])
      .then(([productList, storedRules]) => {
        setProducts(productList);
        setRules(storedRules);
      })
      .catch((err) => {
        if (err.message !== "unauth") {
          setError(err.message || "Failed to load cart limits.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const sortedProducts = products
    .filter((product) => product.status === "active")
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title));

  const restrictedProductIds = new Set(rules.map((rule) => rule.productId));
  const availableProducts = sortedProducts.filter((product) => !restrictedProductIds.has(String(product.id)));
  const selectedProduct = sortedProducts.find((product) => String(product.id) === selectedProductId) ?? null;
  const enabledRules = rules.filter((rule) => rule.enabled);

  const saveRules = async (nextRules: CartQuantityRule[]) => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/standalone/cart-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: nextRules }),
      });
      const data = await safeJson<{ rules?: CartQuantityRule[]; error?: string }>(response);
      if (!response.ok) {
        throw new Error(data?.error ?? `HTTP ${response.status}`);
      }
      setRules(data?.rules ?? nextRules);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save cart limits.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = async () => {
    if (!selectedProduct) {
      setError("Choose a product first.");
      return;
    }

    const nextRules = [
      ...rules,
      {
        id: `cart-limit-${selectedProduct.id}`,
        productId: String(selectedProduct.id),
        productTitle: selectedProduct.title,
        quantity: Number(selectedQuantity) || 1,
        enabled: true,
      },
    ].sort((a, b) => a.productTitle.localeCompare(b.productTitle));

    const saved = await saveRules(nextRules);
    if (saved) {
      setSelectedProductId("");
      setSelectedQuantity("1");
    }
  };

  const handleRuleChange = async (ruleId: string, patch: Partial<CartQuantityRule>) => {
    const nextRules = rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule));
    await saveRules(nextRules);
  };

  const handleDeleteRule = async (ruleId: string) => {
    await saveRules(rules.filter((rule) => rule.id !== ruleId));
  };

  const sel: React.CSSProperties = {
    width: "100%",
    padding: "0.7rem 0.8rem",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    fontSize: "0.875rem",
    background: "#fff",
    color: "#1a1a1a",
  };
  const inp: React.CSSProperties = {
    padding: "0.7rem 0.8rem",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    fontSize: "0.875rem",
    background: "#fff",
    color: "#1a1a1a",
  };
  const lbl: React.CSSProperties = {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "0.35rem",
  };
  const bxgySelect: React.CSSProperties = { ...sel, minWidth: 0, flex: 1 };
  const bxgyVariantSelect: React.CSSProperties = { ...sel, minWidth: "190px", flex: "0 0 220px" };
  const bxgyGiftSelect: React.CSSProperties = { ...sel, maxWidth: "560px" };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading cart limits...</div>;
  }

  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Cart Limits</h1>
        <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.84rem", maxWidth: 760 }}>
          Lock specific products to a fixed cart quantity such as 1 or 2. Customers won&apos;t be able to increase or decrease that product in the product form, cart page, or cart drawer.
        </p>
      </div>

      {error && (
        <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", color: "#c0392b", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        {[
          { label: "Restricted products", value: rules.length, sub: "Products with fixed cart quantity" },
          { label: "Enabled now", value: enabledRules.length, sub: `${rules.length - enabledRules.length} paused` },
          { label: "Active catalog", value: sortedProducts.length, sub: "Products available to choose" },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.85rem 0.95rem" }}>
            <p style={{ margin: 0, fontSize: "0.73rem", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{card.label}</p>
            <p style={{ margin: "0.24rem 0 0.12rem", fontSize: "1.35rem", fontWeight: 700, color: "#111827" }}>{card.value}</p>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280" }}>{card.sub}</p>
          </div>
        ))}
      </div>

      <Card>
        <BlockStack gap="400">
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <PolarisProductAutocomplete
              products={availableProducts}
              value={selectedProductId}
              onChange={setSelectedProductId}
              label="Restricted product"
              placeholder={availableProducts.length > 0 ? "Search product to restrict" : "All active products already configured"}
              helpText="Pick the product that should stay locked to a fixed quantity whenever it appears in the cart."
            />
            <Select
              label="Fixed quantity"
              options={Array.from({ length: 10 }, (_, index) => ({
                label: String(index + 1),
                value: String(index + 1),
              }))}
              value={selectedQuantity}
              onChange={setSelectedQuantity}
            />
          </InlineGrid>
          <InlineStack align="end">
            <Button
              variant="primary"
              onClick={handleAddRule}
              loading={saving}
              disabled={!selectedProductId || availableProducts.length === 0}
            >
              Add cart limit
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>

      <div style={{ marginTop: "1rem", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.1rem", borderBottom: "1px solid #e5e7eb" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Configured cart limits</p>
        </div>
        {rules.length === 0 ? (
          <p style={{ margin: 0, padding: "1.5rem", color: "#6b7280" }}>
            No products are locked yet. Add one above to keep it fixed at quantity 1, 2, or another exact amount.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Product</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Fixed quantity</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Status</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "right", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, index) => (
                <tr key={rule.id} style={{ borderBottom: index < rules.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.86rem", fontWeight: 600, color: "#111827" }}>{rule.productTitle}</td>
                  <td style={{ padding: "0.85rem 0.9rem", width: 180 }}>
                    <Select
                      label=""
                      labelHidden
                      options={Array.from({ length: 10 }, (_, optionIndex) => ({
                        label: String(optionIndex + 1),
                        value: String(optionIndex + 1),
                      }))}
                      value={String(rule.quantity)}
                      onChange={(value) => void handleRuleChange(rule.id, { quantity: Number(value) || 1 })}
                      disabled={saving}
                    />
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem" }}>
                    <button
                      type="button"
                      onClick={() => void handleRuleChange(rule.id, { enabled: !rule.enabled })}
                      disabled={saving}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "0.25rem 0.6rem",
                        borderRadius: "999px",
                        border: "1px solid " + (rule.enabled ? "#bbf7d0" : "#e5e7eb"),
                        background: rule.enabled ? "#f0fdf4" : "#f9fafb",
                        color: rule.enabled ? "#166534" : "#6b7280",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        cursor: saving ? "not-allowed" : "pointer",
                      }}
                    >
                      {rule.enabled ? "Enabled" : "Paused"}
                    </button>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => void handleDeleteRule(rule.id)}
                      disabled={saving}
                      style={{
                        padding: "0.45rem 0.8rem",
                        background: "#fff",
                        color: "#b91c1c",
                        border: "1px solid #fecaca",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        cursor: saving ? "not-allowed" : "pointer",
                      }}
                    >
                      Remove
                    </button>
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
