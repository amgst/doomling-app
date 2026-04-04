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

interface SuggestionDraft {
  productId: string;
  discountPercent: string;
}

export default function UpsellsTab({ storeUrl }: { storeUrl?: string }) {
  const router = useRouter();
  const [rules, setRules] = useState<UpsellRule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggerProductId, setTriggerProductId] = useState("");
  const [message, setMessage] = useState("You might also like these!");
  const [suggestions, setSuggestions] = useState<SuggestionDraft[]>([{ productId: "", discountPercent: "0" }]);

  useEffect(() => {
    Promise.all([
      fetch("/api/standalone/upsells").then(r => r.json()),
      fetch("/api/standalone/products").then(r => r.json()),
    ]).then(([u, p]) => {
      setRules(u.rules ?? []);
      setProducts(p.products ?? []);
    }).catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

  const addSuggestion = () => {
    if (suggestions.length >= 5) return;
    setSuggestions(s => [...s, { productId: "", discountPercent: "0" }]);
  };

  const removeSuggestion = (i: number) => setSuggestions(s => s.filter((_, idx) => idx !== i));

  const updateSuggestion = (i: number, field: keyof SuggestionDraft, val: string) => {
    setSuggestions(s => { const next = [...s]; next[i] = { ...next[i], [field]: val }; return next; });
  };

  const handleAdd = async () => {
    const validSuggestions = suggestions.filter(s => s.productId && s.productId !== triggerProductId);
    if (!triggerProductId) { setError("Select a trigger product."); return; }
    if (validSuggestions.length === 0) { setError("Add at least one suggestion product (different from the trigger)."); return; }
    setSaving(true); setError(null);

    const trigger = products.find(p => String(p.id) === triggerProductId);
    const upsellProducts: UpsellProduct[] = validSuggestions.map(s => {
      const p = products.find(pr => String(pr.id) === s.productId)!;
      return {
        productId: s.productId,
        title: p?.title ?? "",
        image: p?.image?.src ?? "",
        price: p?.variants?.[0]?.price ?? "",
        handle: p?.handle ?? "",
        discountPercent: Number(s.discountPercent) || 0,
      };
    });

    const res = await fetch("/api/standalone/upsells", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        triggerProductId,
        triggerProductTitle: trigger?.title ?? "",
        upsellProducts,
        message,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    const updated = await fetch("/api/standalone/upsells").then(r => r.json());
    setRules(updated.rules ?? []);
    setTriggerProductId("");
    setMessage("You might also like these!");
    setSuggestions([{ productId: "", discountPercent: "0" }]);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/standalone/upsells/${id}`, { method: "DELETE" });
    setRules(r => r.filter(x => x.id !== id));
  };

  const sel: React.CSSProperties = { width: "100%", padding: "0.6rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", background: "#fff", color: "#1a1a1a" };
  const inp: React.CSSProperties = { padding: "0.6rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", background: "#fff", color: "#1a1a1a" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" };

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading…</div>;

  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Upsells</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6d7175", fontSize: "0.875rem" }}>Show product recommendations on product pages</p>
      </div>

      {error && <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", color: "#c0392b", fontSize: "0.875rem" }}>{error}</div>}

      {/* Add rule form */}
      <div style={{ background: "#fff", borderRadius: "10px", padding: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: "1.5rem" }}>
        <p style={{ margin: "0 0 1.25rem", fontWeight: 700, color: "#1a1a1a", fontSize: "0.95rem" }}>New Upsell Rule</p>

        {/* Trigger + message */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <label style={lbl}>When customer views…</label>
            <SearchableProductSelect
              products={products}
              value={triggerProductId}
              onChange={setTriggerProductId}
              placeholder="Search trigger product"
            />
          </div>
          <div>
            <label style={lbl}>Widget message</label>
              <input type="text" style={inp} value={message} onChange={e => setMessage(e.target.value)} />
          </div>
        </div>

        {/* Suggestions */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <label style={{ ...lbl, margin: 0 }}>Suggest these products ({suggestions.length}/5)</label>
            {suggestions.length < 5 && (
              <button onClick={addSuggestion} style={{ padding: "0.3rem 0.75rem", border: "1px solid #008060", borderRadius: "6px", background: "#fff", color: "#008060", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
                + Add product
              </button>
            )}
          </div>

          {suggestions.map((s, i) => {
            const picked = products.find(p => String(p.id) === s.productId);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.6rem", padding: "0.75rem", background: "#f9fafb", borderRadius: "8px" }}>
                {picked?.image?.src && <img src={picked.image.src} alt={picked.title} style={{ width: 36, height: 36, borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />}
                <SearchableProductSelect
                  products={products.filter(p => String(p.id) !== triggerProductId)}
                  value={s.productId}
                  onChange={(value) => updateSuggestion(i, "productId", value)}
                  placeholder="Search suggested product"
                  style={{ flex: 2 }}
                />
                <div style={{ flex: "0 0 110px" }}>
                    <input type="number" min="0" max="100" style={inp} value={s.discountPercent}
                      onChange={e => updateSuggestion(i, "discountPercent", e.target.value)}
                      placeholder="Discount %"
                      title="Discount %" />
                </div>
                <span style={{ fontSize: "0.75rem", color: "#6d7175", flexShrink: 0 }}>% off</span>
                {suggestions.length > 1 && (
                  <button onClick={() => removeSuggestion(i)} style={{ border: "none", background: "none", color: "#c0392b", fontSize: "1rem", cursor: "pointer", flexShrink: 0, padding: "0.1rem 0.3rem" }}>✕</button>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={handleAdd} disabled={saving} style={{
          padding: "0.6rem 1.5rem", background: "#008060", color: "#fff", border: "none",
          borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}>{saving ? "Saving…" : "Add Rule"}</button>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6d7175", background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          No upsell rules yet. Add one above.
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e4e5e7" }}>
                {["When viewing", "Suggestions", "Message", "", ""].map((h, i) => (
                  <th key={i} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 600, color: "#6d7175", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < rules.length - 1 ? "1px solid #f1f1f1" : "none" }}>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", fontWeight: 500, color: "#1a1a1a" }}>
                    {(() => {
                      const triggerProduct = products.find((product) => String(product.id) === r.triggerProductId);
                      const triggerUrl = storeUrl && triggerProduct?.handle
                        ? `${storeUrl.replace(/\/$/, "")}/products/${triggerProduct.handle}`
                        : null;

                      if (!triggerUrl) return r.triggerProductTitle;

                      return (
                        <a
                          href={triggerUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#111827", textDecoration: "none", fontWeight: 600 }}
                        >
                          {r.triggerProductTitle}
                        </a>
                      );
                    })()}
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                      {r.upsellProducts.slice(0, 4).map((p, pi) => (
                        (() => {
                          const productUrl = storeUrl && p.handle
                            ? `${storeUrl.replace(/\/$/, "")}/products/${p.handle}`
                            : null;
                          const content = p.image
                            ? <img key={pi} src={p.image} alt={p.title} title={p.title} style={{ width: 32, height: 32, borderRadius: "6px", objectFit: "cover", border: "1px solid #e4e5e7" }} />
                            : <div key={pi} title={p.title} style={{ width: 32, height: 32, borderRadius: "6px", background: "#f1f1f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", color: "#6d7175" }}>{p.title.slice(0, 2)}</div>;

                          if (!productUrl) return content;

                          return (
                            <a key={pi} href={productUrl} target="_blank" rel="noreferrer" title={p.title} style={{ display: "inline-flex" }}>
                              {content}
                            </a>
                          );
                        })()
                      ))}
                      <span style={{ fontSize: "0.78rem", color: "#6d7175" }}>
                        {r.upsellProducts.length} product{r.upsellProducts.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#6d7175", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.message}</td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <button onClick={() => router.push(`/dashboard/upsell/${r.id}`)} style={{
                      padding: "0.3rem 0.75rem", background: "#f0faf7", color: "#008060",
                      border: "1px solid #b7dfce", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                    }}>View Stats</button>
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <button onClick={() => handleDelete(r.id)} style={{
                      padding: "0.3rem 0.75rem", background: "#fff", color: "#c0392b",
                      border: "1px solid #ffd2d2", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                    }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
