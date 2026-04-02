export interface ThemeSummary {
  id: string;
  name: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
  processing?: boolean;
  processingFailed?: boolean;
}

async function shopifyGraphQL<T>(shop: string, accessToken: string, query: string, variables?: Record<string, unknown>) {
  const response = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.errors?.[0]?.message ?? `Shopify ${response.status}`);
  }

  if (Array.isArray(json?.errors) && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message ?? "Shopify GraphQL request failed");
  }

  return json as T;
}

export async function listThemes(shop: string, accessToken: string): Promise<ThemeSummary[]> {
  const query = `#graphql
    query ThemeList {
      themes(first: 50) {
        nodes {
          id
          name
          role
          createdAt
          updatedAt
          processing
          processingFailed
        }
      }
    }
  `;

  const response = await shopifyGraphQL<{
    data?: { themes?: { nodes?: ThemeSummary[] } };
  }>(shop, accessToken, query);

  const themes = response?.data?.themes?.nodes ?? [];
  return themes.slice().sort((a, b) => {
    if (a.role === "MAIN" && b.role !== "MAIN") return -1;
    if (a.role !== "MAIN" && b.role === "MAIN") return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function publishTheme(shop: string, accessToken: string, id: string): Promise<ThemeSummary> {
  const query = `#graphql
    mutation ThemePublish($id: ID!) {
      themePublish(id: $id) {
        theme {
          id
          name
          role
          updatedAt
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `;

  const response = await shopifyGraphQL<{
    data?: {
      themePublish?: {
        theme?: ThemeSummary;
        userErrors?: Array<{ field?: string[]; message?: string; code?: string }>;
      };
    };
  }>(shop, accessToken, query, { id });

  const result = response?.data?.themePublish;
  const firstError = result?.userErrors?.[0];
  if (firstError?.message) {
    throw new Error(firstError.message);
  }

  if (!result?.theme) {
    throw new Error("Theme publish did not return a theme");
  }

  return result.theme;
}
