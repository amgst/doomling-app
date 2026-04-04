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

export default function ProductsTab({ storeUrl, adminUrl }: { storeUrl?: string; adminUrl?: string }) {
  const PAGE_SIZE = 50;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("/api/standalone/products")
      .then(async r => {
        if (r.status === 401) { window.location.href = "/"; throw new Error("unauth"); }
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
        return d;
      })
      .then(d => setProducts(d.products ?? []))
      .catch(e => { if (e.message !== "unauth") setError(e.message); })
      .finally(() => setLoading(false));
  }, []);

  const activeProducts = products.filter((product) => product.status === "active");
  const inactiveProducts = products.filter((product) => product.status !== "active");
  const filteredProducts = statusFilter === "all"
    ? products
    : statusFilter === "active"
      ? activeProducts
      : inactiveProducts;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginatedProducts = filteredProducts.slice(pageStart, pageStart + PAGE_SIZE);
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filteredProducts.length);
  const filteredActiveProducts = filteredProducts.filter((product) => product.status === "active");
  const filteredInactiveProducts = filteredProducts.filter((product) => product.status !== "active");
  const filteredTotalVariants = filteredProducts.reduce((sum, product) => sum + (product.variants?.length ?? 0), 0);
  const filteredMultiVariantProducts = filteredProducts.filter((product) => hasMeaningfulVariants(product));
  const filteredPricedVariants = filteredProducts.flatMap((product) =>
    (product.variants ?? [])
      .map((variant) => Number.parseFloat(String(variant.price ?? 0)))
      .filter((price) => Number.isFinite(price) && price > 0),
  );
  const filteredAverageVariantPrice = filteredPricedVariants.length
    ? filteredPricedVariants.reduce((sum, price) => sum + price, 0) / filteredPricedVariants.length
    : 0;
  const filteredHighestPricedProduct = filteredProducts.reduce<Product | null>((best, product) => {
    const price = Number.parseFloat(String(product.variants?.[0]?.price ?? 0));
    if (!Number.isFinite(price)) return best;
    if (!best) return product;
    const bestPrice = Number.parseFloat(String(best.variants?.[0]?.price ?? 0));
    return price > bestPrice ? product : best;
  }, null);

  const formatProductPrice = (value?: string) => {
    const amount = Number.parseFloat(String(value ?? 0));
    if (!Number.isFinite(amount) || amount <= 0) return "?";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    border: active ? "1px solid #d1d5db" : "1px solid transparent",
    background: active ? "#ffffff" : "transparent",
    color: "#111827",
    borderRadius: "999px",
    padding: "0.4rem 0.72rem",
    fontSize: "0.82rem",
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    lineHeight: 1,
  });

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading?</div>;
  if (error) return <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", color: "#c0392b", fontSize: "0.875rem" }}>{error}</div>;

  return (
    <>
      <div style={{ marginBottom: "0.9rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Products</h1>
        <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.84rem" }}>
          Catalog overview with product health, variant coverage, and pricing signals.
          {" "}
          {filteredProducts.length > 0 ? `Showing ${pageStart + 1}-${pageEnd} of ${filteredProducts.length}.` : "No products in this view."}
        </p>
      </div>

      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", padding: "0.18rem", background: "#f3f4f6", borderRadius: "999px", marginBottom: "0.9rem" }}>
        {[
          { key: "all", label: "All products", count: products.length },
          { key: "active", label: "Active", count: activeProducts.length },
          { key: "draft", label: "Draft", count: inactiveProducts.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key as "all" | "active" | "draft")}
            style={tabButtonStyle(statusFilter === tab.key)}
          >
            <span>{tab.label}</span>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "1.3rem",
              height: "1.3rem",
              padding: "0 0.34rem",
              borderRadius: "999px",
              background: statusFilter === tab.key ? "#f3f4f6" : "rgba(255,255,255,0.65)",
              color: "#374151",
              fontSize: "0.72rem",
              fontWeight: 700,
            }}>{tab.count}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "0.9rem" }}>
        {[
          { label: "Total products", value: filteredProducts.length, sub: statusFilter === "all" ? "Items in the current feed" : `Products in ${statusFilter} view` },
          { label: "Active products", value: filteredActiveProducts.length, sub: `${filteredInactiveProducts.length} inactive in this view` },
          { label: "Total variants", value: filteredTotalVariants, sub: `${filteredMultiVariantProducts.length} products with options` },
          { label: "Avg variant price", value: filteredAverageVariantPrice ? fmt(filteredAverageVariantPrice, "USD") : "?", sub: filteredHighestPricedProduct ? `Top price: ${filteredHighestPricedProduct.title}` : "No priced products yet" },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.85rem 0.95rem" }}>
            <p style={{ margin: 0, fontSize: "0.73rem", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{card.label}</p>
            <p style={{ margin: "0.24rem 0 0.12rem", fontSize: "1.35rem", fontWeight: 700, color: "#111827" }}>{card.value}</p>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280" }}>{card.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "0.75rem", marginBottom: "0.9rem" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.95rem" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827", fontSize: "0.95rem" }}>Catalog health</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.6rem", marginTop: "0.75rem" }}>
            <div style={{ borderRadius: "10px", background: "#f0fdf4", padding: "0.75rem 0.8rem" }}>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "#166534", fontWeight: 700, textTransform: "uppercase" }}>Active</p>
              <p style={{ margin: "0.18rem 0 0", fontSize: "1.2rem", fontWeight: 700, color: "#14532d" }}>{filteredActiveProducts.length}</p>
            </div>
            <div style={{ borderRadius: "10px", background: "#fff7ed", padding: "0.75rem 0.8rem" }}>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "#c2410c", fontWeight: 700, textTransform: "uppercase" }}>Inactive</p>
              <p style={{ margin: "0.18rem 0 0", fontSize: "1.2rem", fontWeight: 700, color: "#9a3412" }}>{filteredInactiveProducts.length}</p>
            </div>
            <div style={{ borderRadius: "10px", background: "#eff6ff", padding: "0.75rem 0.8rem" }}>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "#1d4ed8", fontWeight: 700, textTransform: "uppercase" }}>Multi-variant</p>
              <p style={{ margin: "0.18rem 0 0", fontSize: "1.2rem", fontWeight: 700, color: "#1e40af" }}>{filteredMultiVariantProducts.length}</p>
            </div>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.95rem" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827", fontSize: "0.95rem" }}>Pricing snapshot</p>
          <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.65rem" }}>
            <div>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280" }}>Average variant price</p>
              <p style={{ margin: "0.12rem 0 0", fontSize: "1.15rem", fontWeight: 700, color: "#111827" }}>{filteredAverageVariantPrice ? fmt(filteredAverageVariantPrice, "USD") : "?"}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280" }}>Highest base price product</p>
              <p style={{ margin: "0.12rem 0 0", fontSize: "0.9rem", fontWeight: 700, color: "#111827" }}>{filteredHighestPricedProduct?.title ?? "?"}</p>
              <p style={{ margin: "0.08rem 0 0", fontSize: "0.76rem", color: "#6b7280" }}>{formatProductPrice(filteredHighestPricedProduct?.variants?.[0]?.price)}</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
              <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Product</th>
              <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Status</th>
              <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Variants</th>
              <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Links</th>
              <th style={{ padding: "0.75rem 0.9rem", textAlign: "right", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Base price</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((p, i) => (
              (() => {
                const storefrontProductUrl = storeUrl ? `${storeUrl.replace(/\/$/, "")}/products/${p.handle}` : null;
                const adminProductUrl = adminUrl ? `${adminUrl.replace(/\/$/, "")}/products/${p.id}` : null;
                return (
              <tr key={p.id} style={{ borderBottom: i < paginatedProducts.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <td style={{ padding: "0.78rem 0.9rem", display: "flex", alignItems: "center", gap: "0.7rem" }}>
                  {p.image?.src ? (
                    <img src={p.image.src} alt={p.title} style={{ width: 38, height: 38, borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 38, height: 38, borderRadius: "8px", background: "#f3f4f6", flexShrink: 0 }} />
                  )}
                  <div>
                    <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{p.title}</p>
                    <p style={{ margin: "0.08rem 0 0", fontSize: "0.74rem", color: "#6b7280" }}>{p.handle}</p>
                  </div>
                </td>
                <td style={{ padding: "0.78rem 0.9rem" }}>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "0.18rem 0.5rem",
                    borderRadius: "999px",
                    fontSize: "0.73rem",
                    fontWeight: 600,
                    background: p.status === "active" ? "#f0fdf4" : "#f9fafb",
                    color: p.status === "active" ? "#166534" : "#6b7280",
                    border: "1px solid " + (p.status === "active" ? "#dcfce7" : "#e5e7eb"),
                  }}>{p.status}</span>
                </td>
                <td style={{ padding: "0.78rem 0.9rem", fontSize: "0.82rem", color: "#374151" }}>
                  <div style={{ display: "grid", gap: "0.06rem" }}>
                    <span>{p.variants?.length ?? 0}</span>
                    <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>{hasMeaningfulVariants(p) ? "Has options" : "Single"}</span>
                  </div>
                </td>
                <td style={{ padding: "0.78rem 0.9rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                    {storefrontProductUrl && (
                      <a
                        href={storefrontProductUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.28rem",
                          padding: "0.28rem 0.56rem",
                          borderRadius: "999px",
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          color: "#374151",
                          textDecoration: "none",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                        }}
                      >
                        Store
                      </a>
                    )}
                    {adminProductUrl && (
                      <a
                        href={adminProductUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.28rem",
                          padding: "0.28rem 0.56rem",
                          borderRadius: "999px",
                          background: "#eff6ff",
                          border: "1px solid #dbeafe",
                          color: "#1d4ed8",
                          textDecoration: "none",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                        }}
                      >
                        Admin
                      </a>
                    )}
                  </div>
                </td>
                <td style={{ padding: "0.78rem 0.9rem", textAlign: "right", fontSize: "0.82rem", color: "#111827", fontWeight: 600 }}>
                  {formatProductPrice(p.variants?.[0]?.price)}
                </td>
              </tr>
                );
              })()
            ))}
          </tbody>
        </table>
      </div>

      {filteredProducts.length > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginTop: "0.85rem", flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#6b7280" }}>
            Page {safePage} of {totalPages}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
              style={{
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#374151",
                borderRadius: "8px",
                padding: "0.45rem 0.8rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: safePage === 1 ? "not-allowed" : "pointer",
                opacity: safePage === 1 ? 0.55 : 1,
              }}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage === totalPages}
              style={{
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#374151",
                borderRadius: "8px",
                padding: "0.45rem 0.8rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: safePage === totalPages ? "not-allowed" : "pointer",
                opacity: safePage === totalPages ? 0.55 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
