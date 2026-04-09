"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BlockStack,
  Button,
  Card,
  Checkbox,
  InlineGrid,
  InlineStack,
  Select,
  Text,
  TextField,
  Thumbnail,
} from "@shopify/polaris";
import FeatureHelpCard from "@/components/dashboard/FeatureHelpCard";
import { safeJson, fmt } from "../shared";
import { type Product, PolarisProductAutocomplete, hasMeaningfulVariants } from "../products";
import type { BundleOffer, BundleOfferItem } from "../types/bundle";

const EMPTY_ITEM_PICKER = "";

export default function BundleOffersTab() {
  const [offers, setOffers] = useState<BundleOffer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("Expansions Bundle");
  const [offerType, setOfferType] = useState<"bundle" | "product">("bundle");
  const [storefrontTitle, setStorefrontTitle] = useState("Standalone bundle product");
  const [bundleLevel, setBundleLevel] = useState<"product" | "variant">("product");
  const [productId, setProductId] = useState("");
  const [code, setCode] = useState("EXPANSIONS");
  const [compareAtPrice, setCompareAtPrice] = useState("95.00");
  const [discountedPrice, setDiscountedPrice] = useState("59.99");
  const [enabled, setEnabled] = useState(true);
  const [items, setItems] = useState<BundleOfferItem[]>([]);
  const [itemPickerProductId, setItemPickerProductId] = useState(EMPTY_ITEM_PICKER);

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
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load discount offers."))
      .finally(() => setLoading(false));
  }, [loadData]);

  const resetForm = () => {
    setEditingId(null);
    setName("Expansions Bundle");
    setOfferType("bundle");
    setStorefrontTitle("Standalone bundle product");
    setBundleLevel("product");
    setProductId("");
    setCode("EXPANSIONS");
    setCompareAtPrice("95.00");
    setDiscountedPrice("59.99");
    setEnabled(true);
    setItems([]);
    setItemPickerProductId(EMPTY_ITEM_PICKER);
  };

  const selectedBundleProduct = products.find((product) => String(product.id) === productId) ?? null;
  const usedStandaloneProductIds = new Set(
    offers.filter((offer) => offer.id !== editingId).map((offer) => String(offer.productId)),
  );
  const selectableStandaloneProducts = products.filter(
    (product) => !usedStandaloneProductIds.has(String(product.id)),
  );
  const totalSavings = offers.reduce((sum, offer) => {
    const comparePrice = Number(offer.compareAtPrice);
    const salePrice = Number(offer.discountedPrice);
    return sum + Math.max(comparePrice - salePrice, 0);
  }, 0);

  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const isBundleOffer = offerType === "bundle";

  const availableBundleItems = useMemo(() => {
    const selectedIds = new Set(items.map((item) => String(item.productId)));
    return products.filter((product) => !selectedIds.has(String(product.id)));
  }, [items, products]);

  const syncItemForLevel = useCallback(
    (item: BundleOfferItem): BundleOfferItem => {
      const product = products.find((entry) => String(entry.id) === String(item.productId));
      if (!product) return item;

      if (bundleLevel === "product") {
        return { ...item, variantId: undefined, variantTitle: undefined };
      }

      if (!hasMeaningfulVariants(product)) {
        const firstVariant = product.variants[0];
        return {
          ...item,
          variantId: firstVariant ? String(firstVariant.id) : undefined,
          variantTitle: firstVariant?.title,
        };
      }

      if (item.variantId && product.variants.some((variant) => String(variant.id) === String(item.variantId))) {
        const currentVariant = product.variants.find((variant) => String(variant.id) === String(item.variantId));
        return {
          ...item,
          variantTitle: currentVariant?.title,
        };
      }

      return {
        ...item,
        variantId: undefined,
        variantTitle: undefined,
      };
    },
    [bundleLevel, products],
  );

  useEffect(() => {
    setItems((current) => current.map(syncItemForLevel));
  }, [bundleLevel, syncItemForLevel]);

  const addBundleItem = () => {
    const product = products.find((entry) => String(entry.id) === itemPickerProductId);
    if (!product) return;

    const nextItem: BundleOfferItem = syncItemForLevel({
      productId: String(product.id),
      productTitle: product.title,
      quantity: 1,
      image: product.image?.src ?? undefined,
    });

    setItems((current) => [...current, nextItem]);
    setItemPickerProductId(EMPTY_ITEM_PICKER);
  };

  const updateItem = (productKey: string, updater: (item: BundleOfferItem) => BundleOfferItem) => {
    setItems((current) =>
      current.map((item) => (String(item.productId) === productKey ? updater(item) : item)),
    );
  };

  const removeItem = (productKey: string) => {
    setItems((current) => current.filter((item) => String(item.productId) !== productKey));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Enter an offer name.");
      setSuccessMessage(null);
      return;
    }
    if (!storefrontTitle.trim()) {
      setError("Enter the storefront title for the discounted storefront product.");
      setSuccessMessage(null);
      return;
    }
    if (!productId) {
      setError("Choose the storefront product to control.");
      setSuccessMessage(null);
      return;
    }
    if (!code.trim()) {
      setError("Enter the public discount code name.");
      setSuccessMessage(null);
      return;
    }
    if (isBundleOffer && items.length === 0) {
      setError("Add at least one product to the bundle.");
      setSuccessMessage(null);
      return;
    }

    const preparedItems = (isBundleOffer ? items : []).map((item) => {
      const product = products.find((entry) => String(entry.id) === String(item.productId));
      const variant = product?.variants.find((entry) => String(entry.id) === String(item.variantId));
      return {
        ...item,
        productTitle: product?.title ?? item.productTitle,
        image: product?.image?.src ?? item.image,
        variantTitle: variant?.title ?? item.variantTitle,
      };
    });

    if (
      bundleLevel === "variant" &&
      preparedItems.some((item) => {
        const product = products.find((entry) => String(entry.id) === String(item.productId));
        return hasMeaningfulVariants(product) && !item.variantId;
      })
    ) {
      setError("Choose a variant for each bundled product when variant level is selected.");
      setSuccessMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/standalone/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name,
          offerType,
          productId,
          productTitle: selectedBundleProduct?.title ?? "",
          storefrontTitle,
          bundleLevel,
          items: preparedItems,
          code,
          compareAtPrice,
          discountedPrice,
          enabled,
        }),
      });
      const data = await safeJson<{ offers?: BundleOffer[]; warning?: string; error?: string }>(response);
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      const wasEditing = !!editingId;
      setOffers(data?.offers ?? []);
      resetForm();
      if (data?.warning) {
        setError(`Offer ${wasEditing ? "updated" : "created"}, but discount sync failed: ${data.warning}`);
      } else {
        setSuccessMessage(wasEditing ? "Offer updated." : "Offer created.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save discount offer.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (offerId: string) => {
    if (!confirm("Delete this discount offer? This cannot be undone.")) return;
    setDeletingId(offerId);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`/api/standalone/bundles/${offerId}`, { method: "DELETE" });
      const data = await safeJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      setOffers((current) => current.filter((offer) => offer.id !== offerId));
      if (editingId === offerId) resetForm();
      setSuccessMessage("Offer deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete discount offer.");
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (offer: BundleOffer) => {
    setEditingId(offer.id);
    setName(offer.name);
    setOfferType(offer.offerType ?? "bundle");
    setStorefrontTitle(offer.storefrontTitle || offer.productTitle);
    setBundleLevel(offer.bundleLevel || "product");
    setProductId(offer.productId);
    setCode(offer.code);
    setCompareAtPrice(offer.compareAtPrice);
    setDiscountedPrice(offer.discountedPrice);
    setEnabled(offer.enabled);
    setItems(offer.items ?? []);
    setItemPickerProductId(EMPTY_ITEM_PICKER);
    setError(null);
    setSuccessMessage(null);
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading discount offers...</div>;
  }

  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a1a1a" }}>Discount Offers</h1>
        <p style={{ margin: "0.2rem 0 0", color: "#6d7175", fontSize: "0.84rem", maxWidth: 900 }}>
          Manage non-stackable native discount codes for both standalone discounted products and bundle products, while still showing the sale price across the storefront.
        </p>
      </div>

      {error && (
        <div style={{ background: "#fff4f4", border: "1px solid #ffd2d2", borderRadius: "8px", padding: "0.75rem 1rem", color: "#c0392b", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "0.75rem 1rem", color: "#166534", fontSize: "0.875rem", marginBottom: "1rem" }}>
          {successMessage}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        {[
          { label: "Discount offers", value: offers.length, sub: "Products and bundles managed here" },
          { label: "Active now", value: offers.filter((offer) => offer.enabled).length, sub: `${offers.filter((offer) => !offer.enabled).length} paused` },
          { label: "Tracked savings", value: fmt(totalSavings, "USD"), sub: "Difference between compare-at and sale price" },
          { label: "Items in draft", value: itemCount, sub: isBundleOffer ? "Total quantities inside the current bundle" : "Only used when this offer is a bundle" },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "0.85rem 0.95rem" }}>
            <p style={{ margin: 0, fontSize: "0.73rem", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{card.label}</p>
            <p style={{ margin: "0.24rem 0 0.12rem", fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>{card.value}</p>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "#6b7280" }}>{card.sub}</p>
          </div>
        ))}
      </div>

      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">General information</Text>
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <TextField label="Offer name" value={name} onChange={setName} autoComplete="off" helpText="Internal name for your team. Customers will not see this name." />
              <TextField label="Title" value={storefrontTitle} onChange={setStorefrontTitle} autoComplete="off" helpText="This title is used for the discounted storefront product." />
              <Select
                label="Offer type"
                options={[
                  { label: "Bundle product", value: "bundle" },
                  { label: "Standalone discounted product", value: "product" },
                ]}
                value={offerType}
                onChange={(value) => setOfferType(value === "product" ? "product" : "bundle")}
                helpText="Choose bundle product when you want to track included items. Choose standalone product when you only need a product-specific native discount code."
              />
              <PolarisProductAutocomplete
                products={editingId ? products : selectableStandaloneProducts}
                value={productId}
                onChange={setProductId}
                label="Storefront product"
                placeholder="Search storefront product"
                helpText="Choose the product that should show the sale price and receive the native discount code in cart."
              />
              <div style={{ display: "flex", alignItems: "end" }}>
                <Checkbox label="Offer is active" checked={enabled} onChange={setEnabled} />
              </div>
            </InlineGrid>
          </BlockStack>
        </Card>

        {isBundleOffer && (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Bundle product level</Text>
              <Select
                label="Bundle level"
                options={[
                  { label: "Product level", value: "product" },
                  { label: "Variant level", value: "variant" },
                ]}
                value={bundleLevel}
                onChange={(value) => setBundleLevel(value === "variant" ? "variant" : "product")}
                helpText="Use product level for simple bundles. Use variant level if each bundled item should target a specific variant."
              />
            </BlockStack>
          </Card>
        )}

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Price</Text>
            <Text as="p" tone="subdued">You control the compare-at value and the discounted storefront price shown for this product throughout the storefront.</Text>
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
              <TextField label="Public discount code" value={code} onChange={(value) => setCode(value.toUpperCase())} autoComplete="off" helpText="Shown in cart and checkout, for example EXPANSIONS." />
              <TextField label="Compare-at / value price" type="number" min={0} step={0.01} value={compareAtPrice} onChange={setCompareAtPrice} autoComplete="off" />
              <TextField label="Discounted storefront price" type="number" min={0} step={0.01} value={discountedPrice} onChange={setDiscountedPrice} autoComplete="off" />
            </InlineGrid>
          </BlockStack>
        </Card>

        {isBundleOffer && (
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">Products in the bundle</Text>
              <Text as="p" tone="subdued">
                Add the products you want to include in this bundle. You can include multiple products and set a quantity for each one.
              </Text>
            </BlockStack>

            <InlineStack gap="300" blockAlign="end" wrap>
              <div style={{ flex: 1, minWidth: 260 }}>
                <PolarisProductAutocomplete
                  products={availableBundleItems}
                  value={itemPickerProductId}
                  onChange={setItemPickerProductId}
                  label="Add product"
                  placeholder="Search product to include"
                  helpText="You can add up to 30 products to a bundle."
                />
              </div>
              <Button onClick={addBundleItem} disabled={!itemPickerProductId || items.length >= 30}>
                Add product
              </Button>
            </InlineStack>

            {items.length === 0 ? (
              <div style={{ border: "1px dashed #d1d5db", borderRadius: 12, padding: "1rem", color: "#6b7280" }}>
                No bundled products yet. Add your first product above.
              </div>
            ) : (
              <BlockStack gap="300">
                {items.map((item) => {
                  const product = products.find((entry) => String(entry.id) === String(item.productId));
                  const variantOptions = [
                    { label: "Select variant", value: "" },
                    ...((product?.variants ?? []).map((variant) => ({ label: variant.title, value: String(variant.id) }))),
                  ];
                  const needsVariant = bundleLevel === "variant" && hasMeaningfulVariants(product);

                  return (
                    <div key={item.productId} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: "0.95rem 1rem", background: "#fff" }}>
                      <InlineGrid columns={{ xs: 1, md: needsVariant ? 4 : 3 }} gap="300">
                        <InlineStack gap="300" blockAlign="center">
                          {item.image ? (
                            <Thumbnail source={item.image} alt={item.productTitle} size="small" />
                          ) : null}
                          <BlockStack gap="050">
                            <Text as="p" variant="bodyMd" fontWeight="semibold">{item.productTitle}</Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              {needsVariant ? "Choose a variant and quantity for this product." : "Set how many of this product should be included."}
                            </Text>
                          </BlockStack>
                        </InlineStack>

                        {needsVariant ? (
                          <Select
                            label="Variant"
                            options={variantOptions}
                            value={item.variantId ?? ""}
                            onChange={(value) => {
                              const selectedVariant = product?.variants.find((variant) => String(variant.id) === value);
                              updateItem(String(item.productId), (current) => ({
                                ...current,
                                variantId: value || undefined,
                                variantTitle: selectedVariant?.title,
                              }));
                            }}
                          />
                        ) : (
                          <div />
                        )}

                        <TextField
                          label="Quantity"
                          type="number"
                          min={1}
                          value={String(item.quantity || 1)}
                          onChange={(value) => {
                            updateItem(String(item.productId), (current) => ({
                              ...current,
                              quantity: Math.max(1, Number.parseInt(value || "1", 10) || 1),
                            }));
                          }}
                          autoComplete="off"
                        />

                        <div style={{ display: "flex", alignItems: "end", justifyContent: "flex-end" }}>
                          <Button tone="critical" variant="tertiary" onClick={() => removeItem(String(item.productId))}>
                            Remove
                          </Button>
                        </div>
                      </InlineGrid>
                    </div>
                  );
                })}
              </BlockStack>
            )}
          </BlockStack>
        </Card>
        )}

        <InlineStack align="space-between" blockAlign="center">
          <Text as="p" tone="subdued">
            Enable the `Bundle offers` app embed in your theme so homepage, collection, and product pages show the sale price preview and apply the matching code in cart.
          </Text>
          <InlineStack gap="300">
            {editingId && <Button onClick={resetForm} disabled={saving}>Cancel</Button>}
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editingId ? "Update offer" : "Save offer"}
            </Button>
          </InlineStack>
        </InlineStack>
      </BlockStack>

      <div style={{ marginTop: "1rem", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.1rem", borderBottom: "1px solid #e5e7eb" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>Configured discount offers</p>
        </div>
        {offers.length === 0 ? (
          <p style={{ margin: 0, padding: "1.5rem", color: "#6b7280" }}>
            No discount offers yet. Create the first one above, then enable the Bundle Offers app embed in the theme customizer.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Offer</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Storefront product</th>
                <th style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.76rem", fontWeight: 600, color: "#6b7280" }}>Contents</th>
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
                    <div style={{ fontSize: "0.76rem", color: "#6b7280", marginTop: "0.15rem" }}>
                      {offer.offerType === "product"
                        ? "Standalone discounted product"
                        : offer.bundleLevel === "variant"
                          ? "Bundle at variant level"
                          : "Bundle at product level"}
                    </div>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.82rem", color: "#374151" }}>
                    <div>{offer.productTitle}</div>
                    <div style={{ fontSize: "0.76rem", color: "#6b7280", marginTop: "0.15rem" }}>{offer.storefrontTitle}</div>
                  </td>
                  <td style={{ padding: "0.85rem 0.9rem", fontSize: "0.82rem", color: "#374151" }}>
                    {offer.offerType === "product" ? (
                      <div style={{ fontSize: "0.76rem", color: "#6b7280", maxWidth: 280 }}>
                        No bundle contents tracked for this offer.
                      </div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600, color: "#111827" }}>
                          {offer.items.length} product{offer.items.length === 1 ? "" : "s"}
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "#6b7280", marginTop: "0.15rem", maxWidth: 280 }}>
                          {offer.items
                            .slice(0, 3)
                            .map((item) => `${item.productTitle} x${item.quantity}`)
                            .join(", ")}
                          {offer.items.length > 3 ? ` +${offer.items.length - 3} more` : ""}
                        </div>
                      </>
                    )}
                  </td>
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
                      <Button size="micro" tone="critical" variant="tertiary" onClick={() => void handleDelete(offer.id)} loading={deletingId === offer.id} disabled={deletingId === offer.id}>
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

      <div style={{ marginTop: "1.5rem" }}>
        <FeatureHelpCard
          intro="You can browse our app guide to understand discount offers, read simple examples, and get setup help whenever you need it."
          sections={[
            {
              title: "Getting started",
              body: [
                "Choose the storefront product first, then decide whether this offer is a bundle product or a standalone discounted product.",
                "If the offer is a bundle, add the products you want inside it and set a quantity for each one.",
              ],
            },
            {
              title: "Field guide",
              body: [
                "Offer name is for your team. Title is the shopper-facing title for the discounted storefront product.",
                "Bundle product is best when you want to track included items. Standalone discounted product is best when you only need a protected native code for one product.",
              ],
            },
            {
              title: "Examples",
              body: [
                "You can create an Expansions Bundle that includes several different products with quantity 1 each.",
                "You can also create a standalone discounted product offer where no bundle contents are tracked, but the product still gets its own non-stackable code.",
              ],
            },
            {
              title: "Common questions",
              body: [
                "The storefront product is the item that carries the sale price display and discount code behavior.",
                "After saving the offer, visit the storefront product page once to make sure the price preview and cart code flow look correct.",
              ],
            },
          ]}
        />
      </div>
    </>
  );
}
