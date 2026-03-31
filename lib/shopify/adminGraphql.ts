export type ShopifyGraphqlResponse = any;

export async function shopifyAdminGraphql(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
) {
  const res = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify GraphQL HTTP ${res.status}`);
  return (await res.json()) as ShopifyGraphqlResponse;
}

