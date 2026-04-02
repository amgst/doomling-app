"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Select,
  Spinner,
  Text,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";

interface Product {
  id: number;
  title: string;
  handle: string;
  status: string;
}

interface CartQuantityRule {
  id: string;
  productId: string;
  productTitle: string;
  quantity: number;
  enabled: boolean;
}

interface ProductOption {
  label: string;
  value: string;
}

export default function CartLimitsPage() {
  const app = useAppBridge();
  const [products, setProducts] = useState<Product[]>([]);
  const [rules, setRules] = useState<CartQuantityRule[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productOptions: ProductOption[] = products
    .filter((product) => product.status === "active")
    .filter((product) => !rules.some((rule) => rule.productId === String(product.id)))
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((product) => ({
      label: product.title,
      value: String(product.id),
    }));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await app.idToken();
      const [productsRes, rulesRes] = await Promise.all([
        fetch("/api/products", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/cart-limits", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const productsData = await productsRes.json();
      const rulesData = await rulesRes.json();

      if (!productsRes.ok) throw new Error(productsData.error ?? `HTTP ${productsRes.status}`);
      if (!rulesRes.ok) throw new Error(rulesData.error ?? `HTTP ${rulesRes.status}`);

      setProducts(productsData.products ?? []);
      setRules(rulesData.rules ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cart limits.");
    } finally {
      setLoading(false);
    }
  }, [app]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const persistRules = useCallback(
    async (nextRules: CartQuantityRule[]) => {
      setSaving(true);
      setError(null);

      try {
        const token = await app.idToken();
        const response = await fetch("/api/cart-limits", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rules: nextRules }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
        setRules(data.rules ?? nextRules);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save cart limits.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [app],
  );

  const addRule = async () => {
    const product = products.find((item) => String(item.id) === selectedProductId);
    if (!product) {
      setError("Choose a product first.");
      return;
    }

    const saved = await persistRules(
      [
        ...rules,
        {
          id: `cart-limit-${product.id}`,
          productId: String(product.id),
          productTitle: product.title,
          quantity: Number(selectedQuantity) || 1,
          enabled: true,
        },
      ].sort((a, b) => a.productTitle.localeCompare(b.productTitle)),
    );

    if (saved) {
      setSelectedProductId("");
      setSelectedQuantity("1");
    }
  };

  const updateRule = async (ruleId: string, patch: Partial<CartQuantityRule>) => {
    await persistRules(rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)));
  };

  const removeRule = async (ruleId: string) => {
    await persistRules(rules.filter((rule) => rule.id !== ruleId));
  };

  return (
    <Page
      title="Cart limits"
      subtitle="Lock selected products to an exact cart quantity in product forms, cart page, and cart drawer."
      primaryAction={
        <Button variant="primary" onClick={addRule} loading={saving} disabled={!selectedProductId}>
          Add cart limit
        </Button>
      }
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" title="Error">
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}

        {loading ? (
          <Layout.Section>
            <Card>
              <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                <Spinner size="large" />
              </div>
            </Card>
          </Layout.Section>
        ) : (
          <>
            <Layout.Section>
              <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
                {[
                  { label: "Restricted products", value: rules.length, help: "Products with exact cart quantity rules" },
                  { label: "Enabled", value: rules.filter((rule) => rule.enabled).length, help: "Rules currently enforced on storefront" },
                  { label: "Available products", value: productOptions.length, help: "Active products not yet configured" },
                ].map((item) => (
                  <Card key={item.label}>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">{item.label}</Text>
                      <Text as="p" variant="headingLg">{String(item.value)}</Text>
                      <Text as="p" variant="bodySm" tone="subdued">{item.help}</Text>
                    </BlockStack>
                  </Card>
                ))}
              </InlineGrid>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Add product rule</Text>
                  <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                    <Select
                      label="Product"
                      options={[{ label: "Select product", value: "" }, ...productOptions]}
                      value={selectedProductId}
                      onChange={setSelectedProductId}
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
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Configured rules</Text>
                  {rules.length === 0 ? (
                    <Text as="p" tone="subdued">
                      No cart limits yet. Add one above to keep a product fixed at quantity 1, 2, or another exact amount.
                    </Text>
                  ) : (
                    <BlockStack gap="300">
                      {rules.map((rule) => (
                        <div
                          key={rule.id}
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 12,
                            padding: "1rem",
                          }}
                        >
                          <BlockStack gap="300">
                            <InlineStack align="space-between" blockAlign="center">
                              <BlockStack gap="100">
                                <Text as="p" variant="headingSm">{rule.productTitle}</Text>
                                <Text as="p" variant="bodySm" tone="subdued">
                                  Locked to quantity {rule.quantity} in cart and drawer.
                                </Text>
                              </BlockStack>
                              <Button tone="critical" variant="secondary" onClick={() => void removeRule(rule.id)} disabled={saving}>
                                Remove
                              </Button>
                            </InlineStack>
                            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                              <Select
                                label="Fixed quantity"
                                options={Array.from({ length: 10 }, (_, index) => ({
                                  label: String(index + 1),
                                  value: String(index + 1),
                                }))}
                                value={String(rule.quantity)}
                                onChange={(value) => void updateRule(rule.id, { quantity: Number(value) || 1 })}
                                disabled={saving}
                              />
                              <div style={{ paddingTop: "1.65rem" }}>
                                <Checkbox
                                  label="Enable this rule"
                                  checked={rule.enabled}
                                  onChange={(checked) => void updateRule(rule.id, { enabled: checked })}
                                  disabled={saving}
                                />
                              </div>
                            </InlineGrid>
                          </BlockStack>
                        </div>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}
