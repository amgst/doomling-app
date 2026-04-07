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
import FeatureHelpCard from "@/components/dashboard/FeatureHelpCard";
import PolarisProvider from "@/components/PolarisProvider";
import type { GeoCountdownCampaign, GeoCountdownPageTarget } from "@/lib/geoCountdown";
import { fmt, RANGES, calcTrend, safeJson } from "../shared";
import { type Product, SearchableProductSelect } from "../products";
import type { UpsellProduct, UpsellRule, RuleStat } from "../types/upsell";

interface SuggestionDraft {
  productId: string;
  discountPercent: string;
  badgeText: string;
}

function ProductThumb({ p, url }: { p: UpsellProduct; url: string | null }) {
  const img = p.image
    ? <img src={p.image} alt={p.title} title={p.title} style={{ width: 32, height: 32, borderRadius: "6px", objectFit: "cover", border: "1px solid #e4e5e7" }} />
    : <div title={p.title} style={{ width: 32, height: 32, borderRadius: "6px", background: "#f1f1f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", color: "#6d7175" }}>{p.title.slice(0, 2)}</div>;
  if (!url) return img;
  return <a href={url} target="_blank" rel="noreferrer" title={p.title} style={{ display: "inline-flex" }}>{img}</a>;
}

function ProductCarousel({ products, storefrontUrlForProduct }: {
  products: UpsellProduct[];
  storefrontUrlForProduct: (productId?: string, fallbackHandle?: string) => string | null;
}) {
  const [offset, setOffset] = useState(0);
  const PAGE = 3;
  const canPrev = offset > 0;
  const canNext = offset + PAGE < products.length;
  const visible = products.slice(offset, offset + PAGE);

  const arrowBtn: React.CSSProperties = {
    width: 24, height: 24, border: "1px solid #d1d5db", borderRadius: "50%",
    background: "#fff", cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", fontSize: "0.75rem", color: "#374151", flexShrink: 0, padding: 0,
  };
  const disabledArrow: React.CSSProperties = { ...arrowBtn, opacity: 0.35, cursor: "default" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
      {products.length > PAGE && (
        <button
          style={canPrev ? arrowBtn : disabledArrow}
          disabled={!canPrev}
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
        >‹</button>
      )}
      {visible.map((p, pi) => (
        <ProductThumb key={offset + pi} p={p} url={storefrontUrlForProduct(p.productId, p.handle)} />
      ))}
      {products.length > PAGE && (
        <button
          style={canNext ? arrowBtn : disabledArrow}
          disabled={!canNext}
          onClick={() => setOffset((o) => Math.min(products.length - PAGE, o + 1))}
        >›</button>
      )}
      <span style={{ fontSize: "0.78rem", color: "#6d7175", marginLeft: "0.1rem" }}>
        {products.length > PAGE
          ? `${offset + 1}–${Math.min(offset + PAGE, products.length)} of ${products.length}`
          : `${products.length} product${products.length !== 1 ? "s" : ""}`}
      </span>
    </div>
  );
}

export default function UpsellsTab({ storeUrl }: { storeUrl?: string }) {
  const router = useRouter();
  const [rules, setRules] = useState<UpsellRule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<RuleStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [triggerProductId, setTriggerProductId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionDraft[]>([{ productId: "", discountPercent: "0", badgeText: "" }]);

  useEffect(() => {
    Promise.all([
      fetch("/api/standalone/upsells").then(r => r.json()),
      fetch("/api/standalone/products").then(r => r.json()),
      fetch("/api/standalone/stats").then(r => r.json()),
    ]).then(([u, p, s]) => {
      setRules(u.rules ?? []);
      setProducts(p.products ?? []);
      setStats(s.rules ?? []);
    }).catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

  const addSuggestion = () => {
    if (suggestions.length >= 5) return;
    setSuggestions(s => [...s, { productId: "", discountPercent: "0", badgeText: "" }]);
  };

  const removeSuggestion = (i: number) => setSuggestions(s => s.filter((_, idx) => idx !== i));

  const updateSuggestion = (i: number, field: keyof SuggestionDraft, val: string) => {
    setSuggestions(s => { const next = [...s]; next[i] = { ...next[i], [field]: val }; return next; });
  };

  const handleAdd = async () => {
    const validSuggestions = suggestions.filter(s => s.productId && s.productId !== triggerProductId);
    if (!triggerProductId) { setError("Select a trigger product."); return; }
    if (!campaignName.trim()) { setError("Add a campaign name."); return; }
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
        badgeText: s.badgeText || "",
      };
    });

    const endpoint = editingRuleId ? `/api/standalone/upsells/${editingRuleId}` : "/api/standalone/upsells";
    const method = editingRuleId ? "PATCH" : "POST";
    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingRuleId ?? undefined,
        triggerProductId,
        triggerProductTitle: trigger?.title ?? "",
        upsellProducts,
        message: campaignName.trim(),
        enabled: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    try {
      const [updated, refreshedStats] = await Promise.all([
        fetch("/api/standalone/upsells").then(r => r.json()),
        fetch("/api/standalone/stats").then(r => r.json()),
      ]);
      setRules(updated.rules ?? []);
      setStats(refreshedStats.rules ?? []);
      setEditingRuleId(null);
      setTriggerProductId("");
      setCampaignName("");
      setSuggestions([{ productId: "", discountPercent: "0", badgeText: "" }]);
    } catch {
      setError("Saved, but failed to refresh. Please reload the page.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this upsell campaign? This cannot be undone.")) return;
    const res = await fetch(`/api/standalone/upsells/${id}`, { method: "DELETE" });
    if (!res.ok) { setError("Failed to delete campaign."); return; }
    setRules(r => r.filter(x => x.id !== id));
    setStats(s => s.filter(x => x.ruleId !== id));
  };

  const handleEdit = (rule: UpsellRule) => {
    setEditingRuleId(rule.id);
    setTriggerProductId(rule.triggerProductId);
    setCampaignName(rule.message || "");
    setSuggestions(
      rule.upsellProducts.map((product) => ({
        productId: product.productId,
        discountPercent: String(product.discountPercent ?? 0),
        badgeText: product.badgeText || "",
      })),
    );
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDuplicate = (rule: UpsellRule) => {
    setEditingRuleId(null);
    setTriggerProductId(rule.triggerProductId);
    setCampaignName(rule.message ? `${rule.message} copy` : "");
    setSuggestions(
      rule.upsellProducts.map((product) => ({
        productId: product.productId,
        discountPercent: String(product.discountPercent ?? 0),
        badgeText: product.badgeText || "",
      })),
    );
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleEnabled = async (rule: UpsellRule) => {
    const nextEnabled = rule.enabled === false ? true : false;
    const res = await fetch(`/api/standalone/upsells/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextEnabled }),
    });
    if (!res.ok) {
      setError("Failed to update campaign status.");
      return;
    }
    setRules((current) => current.map((entry) => (entry.id === rule.id ? { ...entry, enabled: nextEnabled } : entry)));
  };

  const sel: React.CSSProperties = { width: "100%", padding: "0.6rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", background: "#fff", color: "#1a1a1a" };
  const inp: React.CSSProperties = { padding: "0.6rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "0.875rem", background: "#fff", color: "#1a1a1a" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" };
  const storefrontUrlForProduct = (productId?: string, fallbackHandle?: string) => {
    if (!storeUrl) return null;
    const liveHandle = products.find((product) => String(product.id) === String(productId || ""))?.handle;
    const handle = liveHandle || fallbackHandle || "";
    if (!handle) return null;
    return `${storeUrl.replace(/\/$/, "")}/products/${handle}`;
  };

  const ruleStatRows = rules.map((rule) => {
    const stat = stats.find((entry) => entry.ruleId === rule.id);
    return {
      key: rule.id,
      campaign: rule.message || "Untitled campaign",
      triggerProductTitle: rule.triggerProductTitle,
      suggestions: rule.upsellProducts,
      views: stat?.views ?? 0,
      clicks: stat?.clicks ?? 0,
      added: stat?.added ?? 0,
      ctr: stat?.ctr ?? "—",
      convRate: stat?.convRate ?? "—",
    };
  });

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#1a1a1a", fontSize: "0.95rem" }}>{editingRuleId ? "Edit Upsell Campaign" : "New Upsell Rule"}</p>
          {editingRuleId && (
            <button
              onClick={() => {
                setEditingRuleId(null);
                setTriggerProductId("");
                setCampaignName("");
                setSuggestions([{ productId: "", discountPercent: "0", badgeText: "" }]);
                setError(null);
              }}
              style={{ padding: "0.32rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", background: "#fff", color: "#374151", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
            >
              Cancel edit
            </button>
          )}
        </div>

        {/* Trigger + campaign name */}
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
            <label style={lbl}>Campaign name</label>
              <input type="text" style={inp} value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Example: Playmat accessories" />
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
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.6rem", padding: "0.75rem", background: "#f9fafb", borderRadius: "8px", flexWrap: "wrap" }}>
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
                <div style={{ flex: "0 0 180px" }}>
                  <select
                    style={{ ...inp, width: "100%" }}
                    value={s.badgeText}
                    onChange={e => updateSuggestion(i, "badgeText", e.target.value)}
                    title="Badge"
                  >
                    <option value="">No badge</option>
                    <option value="Best seller">Best seller</option>
                    <option value="Pairs well with">Pairs well with</option>
                    <option value="Staff pick">Staff pick</option>
                  </select>
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
        }}>{saving ? "Saving..." : editingRuleId ? "Update Campaign" : "Add Rule"}</button>
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
                {["Campaign", "When viewing", "Suggestions", "Status", "Actions", "Stats", ""].map((h, i) => (
                  <th key={i} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.8rem", fontWeight: 600, color: "#6d7175", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < rules.length - 1 ? "1px solid #f1f1f1" : "none" }}>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#111827", fontWeight: 600 }}>
                    {r.message || "Untitled campaign"}
                  </td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", fontWeight: 500, color: "#1a1a1a" }}>
                    {(() => {
                      const triggerProduct = products.find((product) => String(product.id) === r.triggerProductId);
                      const triggerUrl = storefrontUrlForProduct(r.triggerProductId, triggerProduct?.handle);

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
                    <ProductCarousel products={r.upsellProducts} storefrontUrlForProduct={storefrontUrlForProduct} />
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <button
                      onClick={() => void handleToggleEnabled(r)}
                      style={{
                        padding: "0.28rem 0.72rem",
                        background: r.enabled === false ? "#fff7ed" : "#ecfdf5",
                        color: r.enabled === false ? "#c2410c" : "#047857",
                        border: `1px solid ${r.enabled === false ? "#fed7aa" : "#a7f3d0"}`,
                        borderRadius: "999px",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {r.enabled === false ? "Paused" : "Active"}
                    </button>
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button onClick={() => handleEdit(r)} style={{
                        padding: "0.3rem 0.75rem", background: "#fff", color: "#374151",
                        border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                      }}>Edit</button>
                      <button onClick={() => handleDuplicate(r)} style={{
                        padding: "0.3rem 0.75rem", background: "#fff", color: "#1d4ed8",
                        border: "1px solid #bfdbfe", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer",
                      }}>Duplicate</button>
                    </div>
                  </td>
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

      <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden", marginTop: "1.5rem" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e4e5e7" }}>
          <p style={{ margin: 0, fontWeight: 600, color: "#1a1a1a", fontSize: "0.92rem" }}>Campaign Statistics</p>
          <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.8rem" }}>
            Performance per campaign. Detailed stats are available on individual stats pages.
          </p>
        </div>

        {ruleStatRows.length === 0 ? (
          <p style={{ padding: "2rem", textAlign: "center", color: "#6d7175", margin: 0 }}>
            No statistics yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e4e5e7" }}>
                {["Campaign", "Trigger Product", "Suggestions", "Views", "Clicks", "Added", "CTR", "Conv."].map((h, i) => (
                  <th key={i} style={{ padding: "0.75rem 1rem", textAlign: i >= 3 ? "center" : "left", fontSize: "0.8rem", fontWeight: 600, color: "#6d7175", textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ruleStatRows.map((row, index) => (
                <tr key={row.key} style={{ borderBottom: index < ruleStatRows.length - 1 ? "1px solid #f1f1f1" : "none" }}>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#1a1a1a", fontWeight: 600 }}>{row.campaign}</td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#1a1a1a", fontWeight: 500 }}>{row.triggerProductTitle}</td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <ProductCarousel products={row.suggestions} storefrontUrlForProduct={storefrontUrlForProduct} />
                  </td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center", fontSize: "0.875rem", color: "#1a1a1a" }}>{row.views}</td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center", fontSize: "0.875rem", color: "#1a1a1a" }}>{row.clicks}</td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center", fontSize: "0.875rem", color: "#1a1a1a" }}>{row.added}</td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                    <span style={{ background: "#f1f1f1", padding: "0.2rem 0.6rem", borderRadius: "20px", fontSize: "0.8rem" }}>{row.ctr}</span>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
                    <span style={{ background: row.added > 0 ? "#e3f1df" : "#f1f1f1", color: row.added > 0 ? "#1a6b3c" : "#6d7175", padding: "0.2rem 0.6rem", borderRadius: "20px", fontSize: "0.8rem" }}>
                      {row.convRate}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <FeatureHelpCard
          intro="You can browse our app guide to understand upsells, read simple examples, and get setup help whenever you need it."
          sections={[
            {
              title: "Getting started",
              body: [
                "Choose the trigger product first. This is the product the shopper is already viewing or buying.",
                "Then add one or more suggestion products that you want to recommend as upsells.",
              ],
            },
            {
              title: "Field guide",
              body: [
                "Campaign name is your internal label. It helps your team recognize the upsell later.",
                "Suggested products are the items shown to the shopper. You can also add a discount percent or a short badge if needed.",
              ],
            },
            {
              title: "Examples",
              body: [
                "If the shopper views a card game, you can suggest sleeves, a playmat, or an expansion pack.",
                "A small discount or a short badge like Best value can help the suggestion stand out.",
              ],
            },
            {
              title: "Common questions",
              body: [
                "Do not use the same product as both the trigger and the suggestion. The app expects them to be different products.",
                "After saving the rule, visit the storefront product page once to make sure the recommendation appears the way you expect.",
              ],
            },
          ]}
        />
      </div>
    </>
  );
}

